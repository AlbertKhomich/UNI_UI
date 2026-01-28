import { NextResponse } from "next/server";
import { sparqlSelect } from "@/lib/sparql";
import { toDisplayName } from "@/lib/format";

const PREFIXES = `
PREFIX schema: <https://schema.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>
`;

function paperIriFromId(id: string) {
    return `https://dice-research.org/id/publication/ris/${encodeURIComponent(id)}`;
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
          (GROUP_CONCAT(DISTINCT STR(?sameAs0); separator="|") AS ?sameAs)
          (GROUP_CONCAT(DISTINCT STR(?url0); separator="|") AS ?urls)
          (GROUP_CONCAT(DISTINCT STR(?partOf); separator="|") AS ?isPartOf)
          (SAMPLE(?vol) AS ?volume)
          (SAMPLE(?iss) AS ?issue)
          (SAMPLE(?pStart) AS ?pageStart)
          (SAMPLE(?pEnd) AS ?pageEnd)
          (GROUP_CONCAT(DISTINCT STR(?publisher); separator="|") AS ?publisherIris)
          (GROUP_CONCAT(DISTINCT STR(?publisherName); separator="|") AS ?publisherNames)
          (SAMPLE(?access) AS ?accessRights)
          (GROUP_CONCAT(DISTINCT STR(?license); separator="|") AS ?licenses)
          (GROUP_CONCAT(DISTINCT STR(?a); separator="|") AS ?authorIris)
          (GROUP_CONCAT(DISTINCT STR(?aName); separator="; ") AS ?authorNames)
          (GROUP_CONCAT(DISTINCT STR(?e); separator="|") AS ?editorIris)
          (GROUP_CONCAT(DISTINCT STR(?eName); separator="; ") AS ?editorNames)
        WHERE {
          BIND(<${paperIri}> AS ?paper)

          OPTIONAL { ?paper rdf:type ?type0 . }
          
          OPTIONAL { ?paper schema:name ?name . }
          OPTIONAL { ?paper schema:alternateName ?alt . }
          OPTIONAL { ?paper schema:datePublished ?year0 . }
          OPTIONAL { ?paper schema:abstract ?abs . }
          OPTIONAL { ?paper schema:keywords ?kw . }
          
          OPTIONAL { ?paper schema:sameAs ?sameAs0 . }
          OPTIONAL { ?paper schema:url ?url0 . }
          OPTIONAL { ?paper schema:isPartOf ?partOf . }
          
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
          
          OPTIONAL {
            ?paper schema:author ?a .
            OPTIONAL { ?a schema:name ?aName . }
          }
          
          OPTIONAL {
            ?paper schema:editor ?e .
            OPTIONAL { ?e schema:name ?eName . }
          }
        }
        GROUP BY ?paper
        LIMIT 1
        `;

        const rows = await sparqlSelect(query);
        if (rows.length === 0) return NextResponse.json({error: "Not found"}, {status: 404 });

        const row: any = rows[0];

        const split = (s: string, sep: string) => (s ? s.split(sep).map((x) => x.trim()).filter(Boolean) : []);
        const splitPipe = (s: string) => split(s, "|");
        const splitSemi = (s: string) => split(s, ";");

        const authorNames = splitSemi(row.authorNames?.value ?? "").map(toDisplayName);
        const editorNames = splitSemi(row.editorNames?.value ?? "").map(toDisplayName);

        return NextResponse.json({
            id,
            iri: paperIri,
            type: row.type?.value ?? null,
            title: row.title?.value ?? "",
            subtitle: row.subtitle?.value ?? null,
            year: row.year?.value ?? null,
            abstract: row.abstract?.value ?? null,
            keywords: splitSemi(row.keywords?.value ?? ""),
            sameAs: splitPipe(row.sameAs?.value ?? ""),
            urls: splitPipe(row.urls?.value ?? ""),
            isPartOf: splitPipe(row.isPartOf?.value ?? ""),
            volume: row.volume?.value ?? null,
            issue: row.issue?.value ?? null,
            pageStart: row.pageStart?.value ?? null,
            pageEnd: row.pageEnd?.value ?? null,
            numberOfPages: row.numberOfPages?.value ?? null,
            accessRights: row.accessRights?.value ?? null,
            licenses: splitPipe(row.licenses?.value ?? ""),
            publisherNames: splitPipe(row.publisherNames?.value ?? ""),
            authors: authorNames,
            editors: editorNames,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
    }
}