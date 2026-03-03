import { sparqlSelect, SparqlRow } from "@/lib/sparql";

const COUNTRIES_QUERY = `
prefix schema: <https://schema.org/>

SELECT DISTINCT
  ?paper
  ?aff
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

function extractCanonicalCountryCode(input: string): string | null {
    const value = (input ?? "").trim();
    if (!value) return null;

    if (!/^[A-Za-z]{2}$/.test(value)) return null;
    return value.toUpperCase();
}

export async function getCountries() {
    const [countryRows, totalRows] = await Promise.all([
        sparqlSelect(COUNTRIES_QUERY),
        sparqlSelect(TOTAL_PAPERS_QUERY),
    ]);

    const countriesByPaperAff = new Map<string, { paperIri: string; countries: Set<string> }>();

    for (const row of countryRows) {
        const paperIri = getValue(row, "paper").trim();
        const affIri = getValue(row, "aff").trim();
        const countryRaw = getValue(row, "cc").trim();
        if (!paperIri || !countryRaw) continue;

        const key = `${paperIri}|||${affIri || "_noaff_"}`;
        const existing = countriesByPaperAff.get(key);
        if (existing) {
            existing.countries.add(countryRaw);
        } else {
            countriesByPaperAff.set(key, {
                paperIri,
                countries: new Set([countryRaw]),
            });
        }
    }

    const papersByCountry = new Map<string, Set<string>>();

    for (const { paperIri, countries } of countriesByPaperAff.values()) {
        const selectedCountries = Array.from(new Set(
            Array.from(countries)
                .map(extractCanonicalCountryCode)
                .filter((x): x is string => Boolean(x))
        ));

        if (selectedCountries.length === 0) continue;

        for (const countryKey of selectedCountries) {
            if (!papersByCountry.has(countryKey)) {
                papersByCountry.set(countryKey, new Set<string>());
            }
            papersByCountry.get(countryKey)?.add(paperIri);
        }
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
