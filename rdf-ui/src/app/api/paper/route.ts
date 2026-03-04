import { NextResponse } from "next/server";
import { sparqlSelect } from "@/lib/sparql";
import { toDisplayName } from "@/lib/format";
import { SparqlRow } from "@/lib/sparql";
import { Aff } from "@/lib/types";

const PREFIXES = `
PREFIX schema: <https://schema.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>
`;

function paperIriFromId(id: string) {
  const clean = (id ?? "").trim().replace(/^\/+/, "");
  return `https://dice-research.org/id/publication/ris/${clean}`;
}

function extractDoiFromIdentifier(s: string): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;

  const m = t.match(/^DOI:\s*(10\.\d{4,9}\/\S+)\s*$/);
  if (!m) return null;

  return m[1]
}

function doiToUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const id = (url.searchParams.get("id") ?? "").trim();
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const paperIri = paperIriFromId(id);

        const query = `${PREFIXES}
        SELECT
          ?paper
          (SAMPLE(?type0) AS ?type)
          (SAMPLE(?nPages) AS ?numberOfPages)
          (SAMPLE(?name) AS ?title)
          (SAMPLE(?alt) AS ?subtitle)
          (SAMPLE(?year0) AS ?year)
          (SAMPLE(?abs) AS ?abstract)
          (GROUP_CONCAT(DISTINCT ?kw; separator="; ") AS ?keywords)
          (GROUP_CONCAT(DISTINCT ?fieldName0; separator="|") AS ?fields)
          (GROUP_CONCAT(DISTINCT ?subfieldName0; separator="|") AS ?subfields)
          (GROUP_CONCAT(DISTINCT STR(?ident0); separator="|") AS ?identifiers)
          (GROUP_CONCAT(DISTINCT STR(?url0); separator="|") AS ?urls)
          (GROUP_CONCAT(DISTINCT STR(?codeRepo0); separator="|") AS ?codeRepositories)
          (GROUP_CONCAT(DISTINCT STR(?partOf); separator="|") AS ?isPartOf)
          (GROUP_CONCAT(DISTINCT STR(?partOfName); separator="|") AS ?isPartOfNames)
          (SAMPLE(?vol) AS ?volume)
          (SAMPLE(?iss) AS ?issue)
          (SAMPLE(?pStart) AS ?pageStart)
          (SAMPLE(?pEnd) AS ?pageEnd)
          (GROUP_CONCAT(DISTINCT STR(?publisher); separator="|") AS ?publisherIris)
          (GROUP_CONCAT(DISTINCT STR(?publisherName); separator="|") AS ?publisherNames)
          (SAMPLE(?access) AS ?accessRights)
          (GROUP_CONCAT(DISTINCT STR(?license); separator="|") AS ?licenses)
        WHERE {
          BIND(<${paperIri}> AS ?paper)

          OPTIONAL { ?paper rdf:type ?type0 . }
          
          OPTIONAL { ?paper schema:name ?name . }
          OPTIONAL { ?paper schema:alternateName ?alt . }
          OPTIONAL { ?paper schema:datePublished ?year0 . }
          OPTIONAL { ?paper schema:abstract ?abs . }
          OPTIONAL { ?paper schema:keywords ?kw . }
          OPTIONAL {
            ?paper schema:about ?aboutField .
            FILTER(CONTAINS(STR(?aboutField), "openalex.org/fields/"))
            OPTIONAL { ?aboutField schema:name ?aboutFieldName . }
            BIND(COALESCE(STR(?aboutFieldName), STR(?aboutField)) AS ?fieldName0)
          }
          OPTIONAL {
            ?paper schema:about ?aboutSubfield .
            FILTER(CONTAINS(STR(?aboutSubfield), "openalex.org/subfields/"))
            OPTIONAL { ?aboutSubfield schema:name ?aboutSubfieldName . }
            BIND(COALESCE(STR(?aboutSubfieldName), STR(?aboutSubfield)) AS ?subfieldName0)
          }
          OPTIONAL { ?paper schema:identifier ?ident0 . }
          OPTIONAL { ?paper schema:url ?url0 . }
          OPTIONAL { ?paper schema:codeRepository ?codeRepo0 . }

          OPTIONAL { 
            ?paper schema:isPartOf ?partOf . 
            OPTIONAL { ?partOf schema:name ?partOfName . }  
          }
          
          OPTIONAL { ?paper schema:volumeNumber ?vol . }
          OPTIONAL { ?paper schema:issueNumber ?iss . }
          OPTIONAL { ?paper schema:pageStart ?pStart . }
          OPTIONAL { ?paper schema:pageEnd ?pEnd . }
          OPTIONAL { ?paper schema:numberOfPages ?nPages . }

          OPTIONAL { ?paper dcterms:accessRights ?access . }
          OPTIONAL { ?paper dcterms:license ?license . }

          OPTIONAL {
            ?paper schema:publisher ?publisher .
            OPTIONAL { ?publisher schema:name ?publisherName . }
          }
        }
        GROUP BY ?paper
        LIMIT 1
        `;

        const authorQuery = `
        ${PREFIXES}
        SELECT
        ?a
        (SAMPLE(?aName0) AS ?name)
        (SAMPLE(STR(?orcid0)) AS ?orcid)
        ?aff
        (SAMPLE(?affLabel0) AS ?affLabel)
        (MIN(STR(?affRor0)) AS ?affRor)
        (MIN(STR(?cc0)) AS ?countryRaw)
      WHERE {
        BIND(<${paperIri}> AS ?paper)
        ?paper schema:author ?a .

        OPTIONAL { ?a schema:name ?aName0 . }
        OPTIONAL {
          ?a schema:sameAs ?orcid0 .
          FILTER(CONTAINS(LCASE(STR(?orcid0)), "orcid.org"))
        }

        OPTIONAL {
          ?a schema:affiliation ?aff .

          OPTIONAL { ?aff schema:name ?affName . }
          BIND(COALESCE(STR(?affName), STR(?aff)) AS ?affLabel0)
          OPTIONAL {
            ?aff schema:sameAs ?affRor0 .
            FILTER(CONTAINS(LCASE(STR(?affRor0)), "ror.org"))
          }
          OPTIONAL { ?aff schema:addressCountry ?cc0 . }
        }
      }
      GROUP BY ?a ?aff
      ORDER BY LCASE(STR(?name)) STR(?aff)
        `;

        const rows = await sparqlSelect(query);
        if (rows.length === 0) return NextResponse.json({error: "Not found"}, {status: 404 });

        const row = rows[0];

        const authorRows = (await sparqlSelect(authorQuery)) as SparqlRow[];

        const byAuthor = new Map<string, {
          iri: string;
          name: string;
          orcid?: string;
          affiliations: Aff[];
        }>();

        for (const r of authorRows) {
          const authorIri = (r.a?.value ?? "").trim();
          if (!authorIri) continue;

          const authorName = toDisplayName((r.name?.value ?? authorIri).trim());
          const orcid = (r.orcid?.value ?? "").trim() || undefined;

          if (!byAuthor.has(authorIri)) {
            byAuthor.set(authorIri, {
              iri: authorIri,
              name: authorName,
              orcid,
              affiliations: [],
            });
          }

          const author = byAuthor.get(authorIri);
          if (!author) continue;

          if (!author.orcid && orcid) author.orcid = orcid;

          const affIri = (r.aff?.value ?? "").trim();
          if (!affIri) continue;

          const affName = (r.affLabel?.value ?? affIri).trim();
          const affRor = (r.affRor?.value ?? "").trim() || undefined;
          const countryRaw = (r.countryRaw?.value ?? "").trim() || undefined;

          const existingAff = author.affiliations.find((x) => x.iri === affIri);
          if (!existingAff) {
            author.affiliations.push({
              name: affName,
              iri: affIri,
              sameAs: affRor,
              countryRaw,
            });
          } else {
            if (!existingAff.countryRaw && countryRaw) {
              existingAff.countryRaw = countryRaw;
            }
            if (!existingAff.sameAs && affRor) {
              existingAff.sameAs = affRor;
            }
          }
        }

        const authorsDetailed = Array.from(byAuthor.values());

        const split = (s: string, sep: string) => (s ? s.split(sep).map((x) => x.trim()).filter(Boolean) : []);
        const splitPipe = (s: string) => split(s, "|");
        const splitSemi = (s: string) => split(s, ";");

        const authors = authorsDetailed.map((a) => a.name);
        const identifiers = splitPipe(row.identifiers?.value ?? "");

        const doi =
          identifiers
            .map(extractDoiFromIdentifier)
            .find((x): x is string => !!x) ?? null;

        const doiUrl = doi ? doiToUrl(doi) : null;


        return NextResponse.json({
            id,
            iri: paperIri,
            type: row.type?.value ?? null,
            title: row.title?.value ?? "",
            subtitle: row.subtitle?.value ?? null,
            year: row.year?.value ?? null,
            abstract: row.abstract?.value ?? null,
            keywords: splitSemi(row.keywords?.value ?? ""),
            fields: splitPipe(row.fields?.value ?? ""),
            subfields: splitPipe(row.subfields?.value ?? ""),
            sameAs: doiUrl,
            urls: splitPipe(row.urls?.value ?? ""),
            codeRepositories: splitPipe(row.codeRepositories?.value ?? ""),
            isPartOf: splitPipe(row.isPartOf?.value ?? ""),
            isPartOfNames: splitPipe(row.isPartOfNames?.value ?? ""),
            volume: row.volume?.value ?? null,
            issue: row.issue?.value ?? null,
            pageStart: row.pageStart?.value ?? null,
            pageEnd: row.pageEnd?.value ?? null,
            numberOfPages: row.numberOfPages?.value ?? null,
            accessRights: row.accessRights?.value ?? null,
            licenses: splitPipe(row.licenses?.value ?? ""),
            publisherNames: splitPipe(row.publisherNames?.value ?? ""),
            authors,
            authorsDetailed,
        });
    } catch (error: unknown) {
        return NextResponse.json({ error: errorMessage(error, "Unknown error") }, { status: 500 });
    }
}
