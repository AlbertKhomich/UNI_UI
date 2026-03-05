export type SparqlBindingValue = 
| { type: "uri"; value: string }
| { type: "literal"; value: string; "xml:lang"?: string; datatype?: string };

export type SparqlRow = Record<string, SparqlBindingValue | undefined>;
export type SparqlDescribeResult = {
    body: string;
    contentType: string;
};

function mustGetEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export function escapeSparqlStringLiteral(input: string): string {
    const s = (input ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    return `"${s}"`;
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

export async function sparqlDescribe(query: string): Promise<SparqlDescribeResult> {
    const endpoint = mustGetEnv("SPARQL_ENDPOINT");
    const body = new URLSearchParams({ query });

    const r = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            accept: "text/turtle, application/n-triples;q=0.9, application/ld+json;q=0.8, application/rdf+xml;q=0.7, text/plain;q=0.6, */*;q=0.1",
        },
        body,
        cache: "no-store",
    });

    if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`SPARQL error ${r.status}: ${txt.slice(0, 500)}`);
    }

    return {
        body: await r.text(),
        contentType: r.headers.get("content-type") ?? "text/plain; charset=utf-8",
    };
}
