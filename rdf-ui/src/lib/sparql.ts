export type SparqlBindingValue = 
| { type: "uri"; value: string }
| { type: "literal"; value: string; "xml:lang"?: string; datatype?: string };

export type SparqlRow = Record<string, SparqlBindingValue>;

function mustGetEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export function escapeSparqlStringLiteral(input: string): string {
    return input
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

export async function sparqlSelect(query: string): Promise<SparqlRow[]> {
    const endpoint = mustGetEnv("SPARQL_ENDPOINT");

    const body = new URLSearchParams({ query });

    const r = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            accept: "application/sparql-results+json",
        },
        body,
        cache: "no-store",
    });

    if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`SPARQL error ${r.status}: ${txt.slice(0, 500)}`);
    }

    const json = await r.json();
    return (json?.results?.bindings ?? []) as SparqlRow[];
}