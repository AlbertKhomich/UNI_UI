// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeSparqlStringLiteral, sparqlSelect } from "./sparql";

describe("escapeSparqlStringLiteral", () => {
  it("escapes backslashes, quotes and control characters", () => {
    const raw = 'A "quote"\\line\n\tend';
    expect(escapeSparqlStringLiteral(raw)).toBe('"A \\"quote\\"\\\\line\\n\\tend"');
  });
});

describe("sparqlSelect", () => {
  afterEach(() => {
    delete process.env.SPARQL_ENDPOINT;
    vi.unstubAllGlobals();
  });

  it("throws when SPARQL_ENDPOINT is missing", async () => {
    await expect(sparqlSelect("SELECT * WHERE {}")).rejects.toThrow(
      "Missing env var: SPARQL_ENDPOINT",
    );
  });

  it("posts query and returns bindings", async () => {
    process.env.SPARQL_ENDPOINT = "https://example.test/sparql";
    const query = "SELECT * WHERE { ?s ?p ?o }";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: {
            bindings: [{ x: { type: "literal", value: "ok" } }],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await sparqlSelect(query);

    expect(rows).toEqual([{ x: { type: "literal", value: "ok" } }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/sparql");
    expect(init?.method).toBe("POST");
    expect((init?.body as URLSearchParams).get("query")).toBe(query);
  });

  it("throws an error with status and response text for non-ok responses", async () => {
    process.env.SPARQL_ENDPOINT = "https://example.test/sparql";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream failed", { status: 503 })),
    );

    await expect(sparqlSelect("ASK {}")).rejects.toThrow(
      "SPARQL error 503: upstream failed",
    );
  });
});
