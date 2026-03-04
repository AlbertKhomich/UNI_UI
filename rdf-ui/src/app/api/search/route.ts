import { NextResponse } from "next/server";
import { escapeSparqlStringLiteral, sparqlSelect, SparqlRow } from "@/lib/sparql";
import { toDisplayName } from "@/lib/format";

const PREFIXES = `
PREFIX schema: <https://schema.org/>
`;

const CACHE_TTL_MS = 60_000;
type SearchAuthorRef = {
  id: string;
  iri: string;
};

type SearchResultItem = {
  id: string;
  iri: string;
  title: string;
  year?: string;
  authorsText: string;
  authors: SearchAuthorRef[];
};

type SearchPayload = {
  items: SearchResultItem[];
  total: number;
};

type CacheEntry = { ts: number; value: SearchPayload };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): SearchPayload | null {
    const e = cache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return e.value;
}
function cacheSet(key: string, value: SearchPayload) {
    if (cache.size > 300) cache.clear();
    cache.set(key, { ts: Date.now(), value });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

function paperIriFromId(id: string) {
  const clean = (id ?? "").trim().replace(/^\/+/, "");
  return `https://dice-research.org/id/publication/ris/${clean}`;
}


function extractRisIdFromAnything(input: string): string | null {
  const s0 = (input ?? "").trim();
  if (!s0) return null;

  const s = s0.replace(/[)>.,;]+$/, ""); // remove trailing punctuation

  // Capture EVERYTHING after /ris/ (including slashes) until ?/#/end
  const m = s.match(/\/id\/publication\/ris\/(.+?)(?:[?#].*)?$/);
  if (m?.[1]) return m[1];

  const m2 = s.match(/^(?:ris|id)\s*:\s*([^\s]+)\s*$/i);
  if (m2?.[1]) return m2[1];

  if (/^\d+$/.test(s) && s.length !== 4) return s;

  return null;
}


type ParsedOmni = {
  titleQ: string;
  authorQ: string;
  yearQ: string;
  affiliationQ: string;
  countryQ: string;
  countryCodes: string[];
  directRisId: string | null;
  directAuthorIri: string | null;
};

type FilterToken = "author" | "year" | "affiliation" | "country";

const TOKEN_REGEX = /\b(author|a|year|y|affiliation|aff|af|country|c|cc)\s*:\s*/gi;
const TOKEN_MAP: Record<string, FilterToken> = {
  author: "author",
  a: "author",
  year: "year",
  y: "year",
  affiliation: "affiliation",
  aff: "affiliation",
  af: "affiliation",
  country: "country",
  c: "country",
  cc: "country",
};

type CountryIndexEntry = {
  code: string;
  normalizedName: string;
};

const COUNTRY_ALIASES: Record<string, string[]> = {
  us: ["US"],
  usa: ["US"],
  "united states": ["US"],
  "united states of america": ["US"],
  uk: ["GB"],
  "united kingdom": ["GB"],
  "great britain": ["GB"],
  uae: ["AE"],
  "south korea": ["KR"],
  "north korea": ["KP"],
  russia: ["RU"],
  "czech republic": ["CZ"],
  "ivory coast": ["CI"],
};

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  FX: "FR",
};

function canonicalizeCountryCode(input: string): string {
  const code = (input ?? "").trim().toUpperCase();
  if (!code) return "";
  return COUNTRY_CODE_ALIASES[code] ?? code;
}

function addCountryCodeWithAliases(out: Set<string>, rawCode: string) {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return;

  const canonical = canonicalizeCountryCode(code);
  out.add(canonical);
  out.add(code);

  for (const [alias, target] of Object.entries(COUNTRY_CODE_ALIASES)) {
    if (canonicalizeCountryCode(alias) === canonical) out.add(alias);
    if (canonicalizeCountryCode(target) === canonical) out.add(target.toUpperCase());
  }
}

function normalizeCountryLookup(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCountryIndex(): CountryIndexEntry[] {
  let displayNames: Intl.DisplayNames | null = null;

  try {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return [];
  }

  const rows: CountryIndexEntry[] = [];
  for (let i = 65; i <= 90; i += 1) {
    for (let j = 65; j <= 90; j += 1) {
      const code = `${String.fromCharCode(i)}${String.fromCharCode(j)}`;
      const name = displayNames.of(code);
      if (!name) continue;
      if (name.toUpperCase() === code) continue;
      rows.push({
        code,
        normalizedName: normalizeCountryLookup(name),
      });
    }
  }

  return rows;
}

const COUNTRY_INDEX = buildCountryIndex();

const COUNTRY_VARIANTS_BY_CODE: Map<string, string[]> = (() => {
  const byCode = new Map<string, Set<string>>();

  const addVariant = (code: string, variant: string) => {
    const c = (code ?? "").trim().toUpperCase();
    const v = normalizeCountryLookup(variant);
    if (!c || !v) return;
    if (!byCode.has(c)) byCode.set(c, new Set<string>());
    byCode.get(c)?.add(v);
  };

  for (const entry of COUNTRY_INDEX) {
    addVariant(entry.code, entry.normalizedName);
  }

  for (const [alias, codes] of Object.entries(COUNTRY_ALIASES)) {
    for (const code of codes) addVariant(code, alias);
  }

  for (const [aliasCode, canonicalCodeRaw] of Object.entries(COUNTRY_CODE_ALIASES)) {
    const canonicalCode = canonicalizeCountryCode(canonicalCodeRaw);
    addVariant(aliasCode, aliasCode);
    addVariant(aliasCode, canonicalCode);
    addVariant(canonicalCode, aliasCode);
  }

  for (const [code] of byCode) addVariant(code, code);

  const out = new Map<string, string[]>();
  for (const [code, variants] of byCode) {
    out.set(code, Array.from(variants));
  }
  return out;
})();

function resolveCountryCodes(raw: string): string[] {
  const value = (raw ?? "").trim();
  if (!value) return [];

  const out = new Set<string>();
  const directCodes = value.toUpperCase().match(/\b[A-Z]{2}\b/g) ?? [];
  for (const code of directCodes) addCountryCodeWithAliases(out, code);

  const compact = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (/^[A-Z]{2}$/.test(compact)) addCountryCodeWithAliases(out, compact);

  const normalized = normalizeCountryLookup(value);
  if (normalized) {
    const aliased = COUNTRY_ALIASES[normalized] ?? [];
    for (const code of aliased) addCountryCodeWithAliases(out, code);

    for (const entry of COUNTRY_INDEX) {
      if (
        entry.normalizedName === normalized ||
        (normalized.length >= 3 && entry.normalizedName.includes(normalized))
      ) {
        addCountryCodeWithAliases(out, entry.code);
      }
    }
  }

  return Array.from(out).sort();
}

function extractTokenizedFilters(input: string): {
  titleQ: string;
  authorQ: string;
  yearQ: string;
  affiliationQ: string;
  countryQ: string;
} {
  const s = input ?? "";

  const hits: Array<{ start: number; valueStart: number; token: FilterToken }> = [];
  TOKEN_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null = null;
  while ((m = TOKEN_REGEX.exec(s)) !== null) {
    const token = TOKEN_MAP[(m[1] ?? "").toLowerCase()];
    if (!token) continue;
    hits.push({ start: m.index, valueStart: TOKEN_REGEX.lastIndex, token });
  }

  if (hits.length === 0) {
    return { titleQ: s.trim(), authorQ: "", yearQ: "", affiliationQ: "", countryQ: "" };
  }

  const values: Record<FilterToken, string[]> = {
    author: [],
    year: [],
    affiliation: [],
    country: [],
  };
  const titleParts: string[] = [];
  let cursor = 0;

  for (let i = 0; i < hits.length; i += 1) {
    const cur = hits[i];
    if (cur.start > cursor) titleParts.push(s.slice(cursor, cur.start));

    const nextStart = i + 1 < hits.length ? hits[i + 1].start : s.length;
    const rawValue = s.slice(cur.valueStart, nextStart).trim();
    if (rawValue) values[cur.token].push(rawValue);
    cursor = nextStart;
  }

  const titleQ = titleParts.join(" ").replace(/\s+/g, " ").trim();
  const last = (arr: string[]) => arr[arr.length - 1] ?? "";

  return {
    titleQ,
    authorQ: last(values.author),
    yearQ: last(values.year),
    affiliationQ: last(values.affiliation),
    countryQ: last(values.country),
  };
}

function parseOmni(raw: string): ParsedOmni {
  const s = (raw ?? "").trim();

  const directRisId = extractRisIdFromAnything(s);
  if (directRisId) {
    return {
      titleQ: "",
      authorQ: "",
      yearQ: "",
      affiliationQ: "",
      countryQ: "",
      countryCodes: [],
      directRisId,
      directAuthorIri: null,
    };
  }

  const mAuthorIri = s.match(/^\s*(?:a|author)\s*:\s*(<)?(https?:\/\/\S+?)\1?\s*$/i);
  if (mAuthorIri?.[2]) {
    const iri = mAuthorIri[2].trim().replace(/[)>.,;]+$/, "");
    return {
      titleQ: "",
      authorQ: "",
      yearQ: "",
      affiliationQ: "",
      countryQ: "",
      countryCodes: [],
      directRisId: null,
      directAuthorIri: iri,
    };
  }

  if (/^\d{4}$/.test(s)) {
    return {
      titleQ: "",
      authorQ: "",
      yearQ: s,
      affiliationQ: "",
      countryQ: "",
      countryCodes: [],
      directRisId: null,
      directAuthorIri: null,
    };
  }

  const extracted = extractTokenizedFilters(s);

  let titleQ = extracted.titleQ;
  let authorQ = extracted.authorQ;
  let yearQ = "";
  let directAuthorIri: string | null = null;

  if (authorQ) {
    const iriMatch = authorQ.match(/^(<)?(https?:\/\/\S+?)\1?$/i);
    if (iriMatch?.[2]) {
      directAuthorIri = iriMatch[2].trim().replace(/[)>.,;]+$/, "");
      authorQ = "";
    }
  }

  if (extracted.yearQ) {
    const m = extracted.yearQ.match(/\b(\d{4})\b/);
    if (m?.[1]) yearQ = m[1];
  }

  if (!yearQ) {
    const looseYear = titleQ.match(/\b(\d{4})\b/);
    if (looseYear?.[1]) {
      yearQ = looseYear[1];
      titleQ = titleQ.replace(looseYear[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  const countryQ = extracted.countryQ.trim();
  const countryCodes = resolveCountryCodes(countryQ);

  return {
    titleQ: titleQ.trim(),
    authorQ: authorQ.trim(),
    yearQ,
    affiliationQ: extracted.affiliationQ.trim(),
    countryQ,
    countryCodes,
    directRisId: null,
    directAuthorIri,
  };
}

function buildDirectQuery(paperIri: string) {
    return `${PREFIXES}
    SELECT
      ?paper
      (SAMPLE(?name) AS ?title)
      (SAMPLE(?year0) AS ?year)
      (GROUP_CONCAT(DISTINCT ?aNamePick; separator=";") AS ?authors)
      (GROUP_CONCAT(DISTINCT STR(?a); separator="|") AS ?authorIris)
    WHERE {
      BIND(<${paperIri}> AS ?paper)
      OPTIONAL { ?paper schema:name ?name . }
      OPTIONAL { ?paper schema:datePublished ?year0 . }
      optional {
        {
          select ?paper ?a (min(str(?aName)) as ?aNamePick)
          where {
            ?paper schema:author ?a .
            optional { ?a schema:name ?aName . }
          }
            group by ?paper ?a
        }
      }
    }
    GROUP BY ?paper
    LIMIT 1
    `;
}

function buildAuthorExists(authorQ: string): string {
  if (!authorQ) return "";

  const v = authorQ.trim();
  const iriMatch = v.match(/^(<)?(https?:\/\/\S+?)\1?$/i);
  if (iriMatch?.[2]) {
    const authorIri = iriMatch[2].replace(/[)>.,;]+$/, "");
    return `
      FILTER EXISTS {
        ?paper schema:author <${authorIri}> .
      }
    `;
  }

  const authorLit = escapeSparqlStringLiteral(v);
  return `
    FILTER EXISTS {
      ?paper schema:author ?aa .
      ?aa schema:name ?aaName .
      FILTER(CONTAINS(LCASE(STR(?aaName)), LCASE(${authorLit})))
    }
  `;
}

function buildAffiliationExists(affiliationQ: string): string {
  if (!affiliationQ) return "";

  const v = affiliationQ.trim();
  const iriMatch = v.match(/^(<)?(https?:\/\/\S+?)\1?$/i);
  if (iriMatch?.[2]) {
    const affiliationIri = iriMatch[2].replace(/[)>.,;]+$/, "");
    return `
      FILTER EXISTS {
        ?paper schema:author ?aa .
        ?aa schema:affiliation <${affiliationIri}> .
      }
    `;
  }

  const affiliationLit = escapeSparqlStringLiteral(v);
  return `
    FILTER EXISTS {
      ?paper schema:author ?aa .
      ?aa schema:affiliation ?aff .
      OPTIONAL { ?aff schema:name ?affName . }
      FILTER(CONTAINS(LCASE(STR(COALESCE(?affName, ?aff))), LCASE(${affiliationLit})))
    }
  `;
}

function buildCountryExists(countryQ: string, countryCodes: string[]): string {
  if (!countryQ && countryCodes.length === 0) return "";

  if (countryCodes.length > 0) {
    const codeList = countryCodes
      .map((code) => escapeSparqlStringLiteral(code.toUpperCase()))
      .join(", ");

    const normalizedVariants = new Set<string>();
    for (const code of countryCodes.map((x) => x.toUpperCase())) {
      normalizedVariants.add(normalizeCountryLookup(code));
      const variants = COUNTRY_VARIANTS_BY_CODE.get(code) ?? [];
      for (const variant of variants) normalizedVariants.add(variant);
    }
    const normalizedCountryQ = normalizeCountryLookup(countryQ);
    if (normalizedCountryQ) normalizedVariants.add(normalizedCountryQ);

    const variantList = Array.from(normalizedVariants)
      .filter(Boolean)
      .map((variant) => escapeSparqlStringLiteral(variant))
      .join(", ");

    return `
      FILTER EXISTS {
        ?paper schema:author ?aa .
        ?aa schema:affiliation ?aff .
        ?aff schema:addressCountry ?cc0 .
        BIND(
          REPLACE(
            REPLACE(LCASE(STR(?cc0)), "[^a-z0-9]+", " "),
            "^ +| +$",
            ""
          ) AS ?ccNorm
        )
        FILTER(
          UCASE(STR(?cc0)) IN (${codeList})
          || ?ccNorm IN (${variantList})
        )
      }
    `;
  }

  const countryLit = escapeSparqlStringLiteral(countryQ.trim());
  const normalizedLit = escapeSparqlStringLiteral(normalizeCountryLookup(countryQ));
  return `
    FILTER EXISTS {
      ?paper schema:author ?aa .
      ?aa schema:affiliation ?aff .
      ?aff schema:addressCountry ?cc0 .
      BIND(
        REPLACE(
          REPLACE(LCASE(STR(?cc0)), "[^a-z0-9]+", " "),
          "^ +| +$",
          ""
        ) AS ?ccNorm
      )
      FILTER(
        CONTAINS(LCASE(STR(?cc0)), LCASE(${countryLit}))
        || CONTAINS(?ccNorm, ${normalizedLit})
      )
    }
  `;
}

function buildSearchQuery(args: {
    titleQ: string;
    authorQ: string;
    yearQ: string;
    affiliationQ: string;
    countryQ: string;
    countryCodes: string[];
    directAuthorIri?: string | null;
    mode: "starts" | "contains";
    limit: number;
    offset: number;
}) {
    const {
      titleQ,
      authorQ,
      yearQ,
      affiliationQ,
      countryQ,
      countryCodes,
      directAuthorIri,
      mode,
      limit,
      offset,
    } = args;

    const titleLit = titleQ ? escapeSparqlStringLiteral(titleQ) : "";
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

    const authorIriFilter = directAuthorIri
      ? `?paper schema:author <${directAuthorIri}> .`
      : "";

    const authorExists = buildAuthorExists(authorQ);
    const affiliationExists = buildAffiliationExists(affiliationQ);
    const countryExists = buildCountryExists(countryQ, countryCodes);
    

    return `${PREFIXES}
    SELECT
      ?paper
      (SAMPLE(?name) AS ?title)
      (SAMPLE(?year0) AS ?year)
      (GROUP_CONCAT(DISTINCT ?aNamePick; separator=";") AS ?authors)
      (GROUP_CONCAT(DISTINCT STR(?a); separator="|") AS ?authorIris)
    WHERE {
      FILTER(STRSTARTS(STR(?paper), "https://dice-research.org/id/publication/ris/"))

      ${authorIriFilter}

      ?paper schema:name ?name .
      ${titleFilter}
      OPTIONAL { ?paper schema:datePublished ?year0 . }
      ${yearFilter}
      optional {
        {
          select ?paper ?a (min(str(?aName)) as ?aNamePick)
          where {
            ?paper schema:author ?a .
            optional { ?a schema:name ?aName . }
          }
            group by ?paper ?a
        }
      }
      ${authorExists}
      ${affiliationExists}
      ${countryExists}
    }
    GROUP BY ?paper
    ORDER BY LCASE(STR(SAMPLE(?name)))
    LIMIT ${limit}
    OFFSET ${offset}
    `;
}

function buildCountQuery(args: {
    titleQ: string;
    authorQ: string;
    yearQ: string;
    affiliationQ: string;
    countryQ: string;
    countryCodes: string[];
    directAuthorIri?: string | null;
    mode: "starts" | "contains";
}) {
    const { titleQ, authorQ, yearQ, affiliationQ, countryQ, countryCodes, directAuthorIri, mode } = args;

    const titleLit = titleQ ? escapeSparqlStringLiteral(titleQ) : "";
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

    const authorIriFilter = directAuthorIri
      ? `?paper schema:author <${directAuthorIri}> .`
      : "";

    const authorExists = buildAuthorExists(authorQ);
    const affiliationExists = buildAffiliationExists(affiliationQ);
    const countryExists = buildCountryExists(countryQ, countryCodes);

    return `${PREFIXES}
    SELECT (COUNT(DISTINCT ?paper) AS ?total)
    WHERE {
      FILTER(STRSTARTS(STR(?paper), "https://dice-research.org/id/publication/ris/"))

      ${authorIriFilter}

      ?paper schema:name ?name .
      ${titleFilter}
      OPTIONAL { ?paper schema:datePublished ?year0 . }
      ${yearFilter}
      ${authorExists}
      ${affiliationExists}
      ${countryExists}
    }
    `;
}

function toPaperId(paperIri: string): string {
  const m = paperIri.match(/\/ris\/(.+?)(?:[?#].*)?$/);
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
        if (!raw) return NextResponse.json({ items: [], total: 0 });

        if (raw.length > 300) return NextResponse.json({ error: "Querry too long" }, {status: 400 });
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "25") || 25));

        const parsed = parseOmni(raw);
        
        const cacheKey = 
          `t=${parsed.titleQ.toLowerCase()}|a=${parsed.authorQ.toLowerCase()}|y=${parsed.yearQ}|af=${parsed.affiliationQ.toLowerCase()}|c=${parsed.countryQ.toLowerCase()}|cc=${parsed.countryCodes.join(",")}|id=${parsed.directRisId ?? ""}|ai=${(parsed.directAuthorIri ?? "").toLowerCase()}|o=${offset}|l=${limit}`;
        const cached = cacheGet(cacheKey);
        if (cached) return NextResponse.json(cached);
    
        let rows: SparqlRow[] = [];
        let total = 0;
    
        if (parsed.directRisId) {
            const allRows = await sparqlSelect(buildDirectQuery(paperIriFromId(parsed.directRisId)));
            total = allRows.length;
            rows = offset === 0 ? allRows.slice(0, limit) : [];
        } else {
            if (
              !parsed.titleQ &&
              !parsed.authorQ &&
              !parsed.yearQ &&
              !parsed.affiliationQ &&
              !parsed.countryQ &&
              !parsed.directAuthorIri
            ) {
                return NextResponse.json({ items: [], total: 0 });
            }

            if (parsed.titleQ && parsed.titleQ.length < 3) return NextResponse.json({ items: [], total: 0 });

            let modeUsed: "starts" | "contains" = "starts";

            const q1 = buildSearchQuery({ ...parsed, mode: modeUsed, limit, offset });
            rows = await sparqlSelect(q1);
            if (rows.length === 0 && parsed.titleQ) {
                modeUsed = "contains";
                rows = await sparqlSelect(buildSearchQuery({ ...parsed, mode: modeUsed, limit, offset }));
            }

            const countRows = await sparqlSelect(buildCountQuery({ ...parsed, mode: modeUsed }));
            total = Number(countRows[0]?.total?.value ?? 0) || 0;
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
        .filter((item): item is SearchResultItem => item !== null);
    
        const payload = { items, total };
        cacheSet(cacheKey, payload);
        return NextResponse.json(payload);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: errorMessage(error, "Unknown error") },
            { status: 500 }
        );
    }
}
