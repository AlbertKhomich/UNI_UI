import { sparqlSelect, SparqlRow } from "@/lib/sparql";

const COUNTRIES_QUERY = `
prefix schema: <https://schema.org/>

SELECT 
  ?cc
  (count(distinct(?cc)) as ?countriesNumber)
  (count(distinct(?paper)) as ?papersTotal)
WHERE {
  ?paper schema:author ?author .
  ?author schema:affiliation ?aff .
  ?aff schema:addressCountry ?cc .
}
group by ?cc
order by desc(?papersTotal)
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

export async function getCountries() {
    const [countryRows, totalRows] = await Promise.all([
        sparqlSelect(COUNTRIES_QUERY),
        sparqlSelect(TOTAL_PAPERS_QUERY),
    ]);
    const rows = countryRows
        .map((r) => ({
            name: getValue(r, "cc"),
            value: Number.parseInt(getValue(r, "papersTotal"), 10) || 0,
        }))
        .filter((r) => r.name && Number.isFinite(r.value));

    const totalPapers =
      Number.parseInt(getValue(totalRows?.[0] ?? {}, "totalPapers"), 10) || 0;

    return { totalPapers, rows };
}