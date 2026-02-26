import { sparqlSelect, SparqlRow } from "@/lib/sparql";

const COUNTRIES_QUERY = `
prefix schema: <https://schema.org/>

SELECT DISTINCT
  ?paper
  ?cc
WHERE {
  ?paper schema:author ?author .
  ?author schema:affiliation ?aff .
  ?aff schema:addressCountry ?cc .
}
`

const TOTAL_PAPERS_QUERY = `
prefix schema: <https://schema.org/>

select (count(distinct ?paper) as ?totalPapers)
where {
  ?paper schema:author ?author .
}
`

function getValue(row: SparqlRow, key: string): string {
    const v = row[key];
    if (!v) return "";
    return v.value ?? "";
}

function normalizeCountryLookup(input: string): string {
    return (input ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

const COUNTRY_ALIASES: Record<string, string> = {
    us: "US",
    usa: "US",
    "united states": "US",
    "united states of america": "US",
    uk: "GB",
    "united kingdom": "GB",
    "great britain": "GB",
    uae: "AE",
    "south korea": "KR",
    "north korea": "KP",
    russia: "RU",
    "czech republic": "CZ",
    "ivory coast": "CI",
};

const COUNTRY_NAME_TO_CODE: Map<string, string> = (() => {
    const out = new Map<string, string>();
    let displayNames: Intl.DisplayNames | null = null;
    try {
        displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
        return out;
    }

    for (let i = 65; i <= 90; i += 1) {
        for (let j = 65; j <= 90; j += 1) {
            const code = `${String.fromCharCode(i)}${String.fromCharCode(j)}`;
            const name = displayNames.of(code);
            if (!name) continue;
            if (name.toUpperCase() === code) continue;
            const normalized = normalizeCountryLookup(name);
            if (normalized) out.set(normalized, code);
        }
    }

    return out;
})();

function toCanonicalCountryCode(input: string): string | null {
    const value = (input ?? "").trim();
    if (!value) return null;

    const directCode = value.toUpperCase().match(/\b[A-Z]{2}\b/);
    if (directCode?.[0]) return directCode[0];

    const compact = value.toUpperCase().replace(/[^A-Z]/g, "");
    if (/^[A-Z]{2}$/.test(compact)) return compact;

    const normalized = normalizeCountryLookup(value);
    if (!normalized) return null;

    const aliased = COUNTRY_ALIASES[normalized];
    if (aliased) return aliased;

    return COUNTRY_NAME_TO_CODE.get(normalized) ?? null;
}

export async function getCountries() {
    const [countryRows, totalRows] = await Promise.all([
        sparqlSelect(COUNTRIES_QUERY),
        sparqlSelect(TOTAL_PAPERS_QUERY),
    ]);

    const papersByCountry = new Map<string, Set<string>>();

    for (const row of countryRows) {
        const paperIri = getValue(row, "paper").trim();
        const ccRaw = getValue(row, "cc").trim();
        if (!paperIri || !ccRaw) continue;

        const canonicalCode = toCanonicalCountryCode(ccRaw);
        const countryKey = canonicalCode ?? ccRaw;

        if (!papersByCountry.has(countryKey)) {
            papersByCountry.set(countryKey, new Set<string>());
        }
        papersByCountry.get(countryKey)?.add(paperIri);
    }

    const rows = Array.from(papersByCountry.entries())
        .map(([name, papers]) => ({
            name,
            value: papers.size,
        }))
        .sort((a, b) => b.value - a.value);

    const totalPapers =
      Number.parseInt(getValue(totalRows?.[0] ?? {}, "totalPapers"), 10) || 0;

    return { totalPapers, rows };
}
