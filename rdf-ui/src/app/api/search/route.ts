import { NextResponse } from "next/server";
import { escapeSparqlStringLiteral, sparqlSelect } from "@/lib/sparql";
import { toDisplayName } from "@/lib/format";

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

function withLineNumbers(s: string) {
    return s.split("\n").map((l, i) => `${String(i + 1).padStart(3, "0")}: ${l}`).join("\n")
}

function paperIriFromId(id: string) {
    return `https://dice-research.org/id/publication/ris/${encodeURIComponent(id)}`;
}

function extractRisIdFromAnything(input: string): string | null {
    const s = (input ?? "").trim();
    if (!s) return null;

    const m = s.match(/\/id\/publication\/ris\/([^\/#?\s]+)(?:[?#].*)?$/);
    if (m?.[1]) return m[1];

    const m2 = s.match(/^(?:ris|id)\s*:\s*([^\s]+)\s*$/i);
    if (m2?.[1]) return m2[1];

    if (/^\d+$/.test(s) && s.length !== 4) return s;

    return null;
}

function parseOmni(raw: string): { titleQ: string; authorQ: string; yearQ: string; directRisId: string | null } {
    const s = (raw ?? "").trim();

    const directRisId = extractRisIdFromAnything(s);
    if (directRisId) return { titleQ: "", authorQ: "", yearQ: "", directRisId };

    if (/^\d{4}$/.test(s)) return { titleQ: "", authorQ: "", yearQ: s, directRisId: null };

    let titleQ = s;
    let authorQ = "";
    let yearQ = "";

    const authorMatch = titleQ.match(/\b(?:author|a)\s*:\s*([^]+?)(?=\s+\b(?:year|y)\s*:|$)/i);
    if (authorMatch?.[1]) {
        authorQ = authorMatch[1].trim();
        titleQ = titleQ.replace(authorMatch[0], " ").trim();
    }

    const yearMatch = titleQ.match(/\b(?:year|y)\s*:\s*(\d{4})\b/i);
    if (yearMatch?.[1]) {
        yearQ = yearMatch[1];
        titleQ = titleQ.replace(yearMatch[0], " ").trim();
    }

    if (!yearQ) {
        const looseYear = titleQ.match(/\b(\d{4})\b/);
        if (looseYear?.[1]) {
            yearQ = looseYear[1];
            titleQ = titleQ.replace(looseYear[0], " ").trim();
        }
        }

        return { titleQ: titleQ.trim(), authorQ, yearQ, directRisId: null };
    }

function buildDirectQuery(paperIri: string) {
    return `${PREFIXES}
    SELECT
      ?paper
      (SAMPLE(?name) AS ?title)
      (SAMPLE(?year0) AS ?year)
      (GROUP_CONCAT(DISTINCT ?aName0; separator=";") AS ?authors)
      (GROUP_CONCAT(DISTINCT STR(?a0); separator="|") AS ?authorIris)
    WHERE {
      BIND(<${paperIri}> AS ?paper)
      OPTIONAL { ?paper schema:name ?name . }
      OPTIONAL { ?paper schema:datePublished ?year0 . }
      OPTIONAL {
        ?paper schema:author ?a0 .
        OPTIONAL { ?a0 schema:name ?aName0 . }
      }
    }
    GROUP BY ?paper
    LIMIT 1
    `;
}

function buildSearchQuery(args: {
    titleQ: string;
    authorQ: string;
    yearQ: string;
    mode: "starts" | "contains";
}) {
    const { titleQ, authorQ, yearQ, mode } = args;

    const titleLit = titleQ ? escapeSparqlStringLiteral(titleQ) : "";
    const authorLit = authorQ ? escapeSparqlStringLiteral(authorQ) : "";
    const yearLit = yearQ ? escapeSparqlStringLiteral(yearQ) : "";

    const titleFilter = 
    titleQ
      ? (mode === "starts"
          ? `FILTER(STRSTARTS(LCASE(STR(?name)), LCASE(${titleLit})))`
          : `FILTER(CONTAINS(LCASE(STR(?name)), LCASE(${titleLit})))`)
      : "";

    const yearFilter = yearQ 
      ? `
        FILTER(BOUND(?year0))
        FILTER(STR(?year0) = ${yearLit})
        ` 
        : "";

    const authorExists = authorQ
      ? `
      FILTER EXISTS {
        ?paper schema:author ?aa .
        ?aa schema:name ?aaName .
        FILTER(CONTAINS(LCASE(STR(?aaName)), LCASE(${authorLit})))
      }
      `
      : "";

    return `${PREFIXES}
    SELECT
      ?paper
      (SAMPLE(?name) AS ?title)
      (SAMPLE(?year0) AS ?year)
      (GROUP_CONCAT(DISTINCT ?aName; separator=";") AS ?authors)
      (GROUP_CONCAT(DISTINCT STR(?a); separator="|") AS ?authorIris)
    WHERE {
      FILTER(STRSTARTS(STR(?paper), "https://dice-research.org/id/publication/ris/"))

      ?paper schema:name ?name .
      ${titleFilter}

      OPTIONAL { ?paper schema:datePublished ?year0 . }
      ${yearFilter}

      OPTIONAL {
        ?paper schema:author ?a .
        OPTIONAL { ?a schema:name ?aName . }
      }

      ${authorExists}
    }
    GROUP BY ?paper
    ORDER BY LCASE(STR(SAMPLE(?name)))
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
        const raw = (url.searchParams.get("q") ?? url.searchParams.get("title") ?? "").trim();
        if (!raw) return NextResponse.json({ items: [] });

        if (raw.length > 300) return NextResponse.json({ error: "Querry too long" }, {status: 400 });

        const parsed = parseOmni(raw);
        
        const cacheKey = 
          `t=${parsed.titleQ.toLowerCase()}|a=${parsed.authorQ.toLowerCase()}|y=${parsed.yearQ}|id=${parsed.directRisId ?? ""}`;
        const cached = cacheGet(cacheKey);
        if (cached) return NextResponse.json(cached);
    
        let rows: any[] = [];
    
        if (parsed.directRisId) {
            rows = await sparqlSelect(buildDirectQuery(paperIriFromId(parsed.directRisId)));
        } else {
            if (!parsed.titleQ && !parsed.authorQ && !parsed.yearQ) {
                return NextResponse.json({ items: [] });
            }

            if (parsed.titleQ && parsed.titleQ.length < 3) return NextResponse.json({ items: [] });

            const q1 = buildSearchQuery({ ...parsed, mode: "starts"});
            rows = await sparqlSelect(q1);
            if (rows.length === 0 && parsed.titleQ) {
                rows = await sparqlSelect(buildSearchQuery({ ...parsed, mode: "contains" }));
            }
        }
    
        const items = rows.map((row) => {
            const paperIri = row.paper?.value ?? "";
            if (!paperIri) return null;

            const authorIris = (row.authorIris?.value ?? "")
              .split("|")
              .filter(Boolean);
            const rawAuthors = row.authors?.value ?? ""
            const authorsText = rawAuthors
                .split(";")
                .map((s: string) => s.trim())
                .filter(Boolean)
                .map(toDisplayName)
                .join(", ")
    
            return {
                id: toPaperId(paperIri),
                iri: paperIri,
                title: row.title?.value ?? "",
                year: row.year?.value ?? undefined,
                authorsText,
                authors: authorIris.map((iri: string) => ({ id: toPersonId(iri), iri})),
            };
        })
        .filter(Boolean);
    
        const payload = { items };
        cacheSet(cacheKey, payload);
        return NextResponse.json(payload);
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Unknown error" },
            { status: 500 }
        );
    }
}