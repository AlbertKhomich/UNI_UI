import { NextResponse } from "next/server";
import { sparqlSelect } from "@/lib/sparql";
import { toDisplayName } from "@/lib/format";
import { SparqlRow } from "@/lib/sparql";

const PREFIXES = `
PREFIX schema: <https://schema.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>
`;

function paperIriFromId(id: string) {
    return `https://dice-research.org/id/publication/ris/${encodeURIComponent(id)}`;
}

function extractDoiFromIdentifier(s: string): string | null {
  let t = (s ?? "").trim();
  if (!t) return null;

  const m = t.match(/^DOI:\s*(10\.\d{4,9}\/\S+)\s*$/);
  if (!m) return null;

  return m[1]
}

function doiToUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}

function cleanAffiliation(s: string): string | null {
  let t = (s ?? "").trim();
  if (!t) return null;

  t = t.replace(/\s+/g, " ");
  t = t.replace(/[\s,;:]+$/g, "");

  if (/^journal\s*:/i.test(t)) return null;

  if (t.length < 3) return null;
  return t;
}

function uniqCaseInsensitive(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const key = x.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }
  return out;
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
          (GROUP_CONCAT(DISTINCT STR(?ident0); separator="|") AS ?identifiers)
          (GROUP_CONCAT(DISTINCT STR(?url0); separator="|") AS ?urls)
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
          OPTIONAL { ?paper schema:identifier ?ident0 . }
          OPTIONAL { ?paper schema:url ?url0 . }

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

        const authorQuery = `${PREFIXES}
        SELECT
          ?a
          (sample(?aName0) as ?name)
          (group_concat(distinct ?affLabel; separator="|") as ?affs)
        where {
          bind(<${paperIri}> as ?paper)
          ?paper schema:author ?a .

          optional { ?a schema:name ?aName0 . }

          optional {
            ?a schema:affiliation ?aff . 
            optional { ?aff schema:name ?affName. }
            
            bind(
              if(isIRI(?aff),
              coalesce(?affName, str(?aff)),
              str(?aff)
              ) as ?affLabel
            )
          }
        }
        group by ?a
        order by lcase(str(?name))
        `;

        const rows = await sparqlSelect(query);
        if (rows.length === 0) return NextResponse.json({error: "Not found"}, {status: 404 });

        const row: any = rows[0];

        const authorRows = (await sparqlSelect(authorQuery)) as SparqlRow[];

        const authorsDetailed = authorRows.map((r) => {
          const iri = r.a?.value ?? "";
          const name = toDisplayName((r.name?.value ?? iri).trim());

          const affsRaw = (r.affs?.value ?? "")
            .split("|")
            .map((x: string) => x.trim())
            .filter(Boolean);

          const affiliations = uniqCaseInsensitive(
            affsRaw
              .map(cleanAffiliation)
              .filter((x): x is string => x != null)
          );

          return { iri, name, affiliations };
        });

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
            sameAs: doiUrl,
            urls: splitPipe(row.urls?.value ?? ""),
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
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
    }
}