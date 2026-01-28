import { NextResponse } from "next/server";
import { escapeSparqlStringLiteral, sparqlSelect } from "@/lib/sparql";

const PREFIXES = `
PREFIX schema: <https://schema.org/>
`;

const CACHE_TTL_MS = 60_000;
type CacheEntry = { ts: number; value: any };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string) {
    const e = cache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return e.value;
}
function cacheSet(key: string, value: any){
    if (cache.size > 300) cache.clear();
    cache.set(key, { ts: Date.now(), value });
}

function buildQuery(q: string, mode: "starts" | "contains") {
    const filter = 
    mode === "starts"
      ? `FILTER(STRSTARTS(LCASE(STR(?t)), LCASE(STR(?q))))`
      : `FILTER(CONTAINS(LCASE(STR(?t)), LCASE(STR(?q))))`;

    return `${PREFIXES}
    SELECT
      ?paper
      (SAMPLE(?t) AS ?title)
      (SAMPLE(?year0) AS ?year)
      (GROUP_CONCAT(DISTINCT ?aName; separator=", ") AS ?authors)
      (GROUP_CONCAT(DISTINCT STR(?a); separator="|") AS ?authorIris)
    WHERE {
      VALUES ?q { "${q}" }

      ?paper a ?type .
      FILTER(?type IN (schema:ScholarlyArticle, schema:CreativeWork))

      OPTIONAL { ?paper schema:title ?title0 . }
      OPTIONAL { ?paper schema:name ?name0 . }
      BIND(COALESCE(?title0, ?name0) AS ?t)
      FILTER(BOUND(?t))
      FILTER(STRSTARTS(STR(?paper), "https://dice-research.org/id/publication/ris/"))

      OPTIONAL { ?paper schema:datePublished ?year0 . }

      OPTIONAL {
        ?paper schema:author ?a .
        OPTIONAL { ?a schema:name ?aName . }
      }

      ${filter}
    }
    GROUP BY ?paper
    ORDER BY LCASE(STR(SAMPLE(?t)))
    LIMIT 25
    `;
}

function toPaperId(paperIri: string): string {
    const m = paperIri.match(/\/ris\/([^\/#]+)\s*$/);
    return m?.[1] ?? paperIri;
}

function toPersonId(personIri: string): string {
    const m = 
        personIri.match(/\/hash\/([^\/#]+)\s*$/) ??
        personIri.match(/\/uni\/([^\/#]+)\s*$/);
    return m?.[1] ?? personIri;
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const title = (url.searchParams.get("title") ?? "").trim();
    
        if (title.length < 3) return NextResponse.json({items: []});
        if (title.length > 120) {
            return NextResponse.json({error: "Query too long" }, { status: 400 });
        }
    
        const key = title.toLowerCase().replace(/\s+/g, " ").trim();
        const cached = cacheGet(key);
        if (cached) return NextResponse.json(cached);
    
        const q = escapeSparqlStringLiteral(title);
    
        let rows = await sparqlSelect(buildQuery(q, "starts"));
    
        if (rows.length === 0) {
            rows = await sparqlSelect(buildQuery(q, "contains"));
        }
    
        const items = rows.map((row) => {
            const paperIri = row.paper?.value ?? "";
            const authorIris = (row.authorIris?.value ?? "")
              .split("|")
              .filter(Boolean);
    
            return {
                id: toPaperId(paperIri),
                iri: paperIri,
                title: row.title?.value ?? "",
                year: row.year?.value ?? undefined,
                authorsText: row.authors?.value ?? "",
                authors: authorIris.map((iri) => ({ id: toPersonId(iri), iri})),
            };
        });
    
        const payload = { items };
        cacheSet(key, payload);
        return NextResponse.json(payload);
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Unknown error" },
            { status: 500 }
        );
    }
}