// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sparql", () => ({
  sparqlDescribe: vi.fn(),
}));

import { sparqlDescribe } from "@/lib/sparql";
import { GET } from "./route";

const mockedSparqlDescribe = vi.mocked(sparqlDescribe);

describe("GET /api/describe", () => {
  beforeEach(() => {
    mockedSparqlDescribe.mockReset();
  });

  it("returns 400 when iri is missing", async () => {
    const response = await GET(new Request("http://localhost/api/describe"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Missing or invalid iri" });
    expect(mockedSparqlDescribe).not.toHaveBeenCalled();
  });

  it("returns 400 when iri is invalid", async () => {
    const response = await GET(new Request("http://localhost/api/describe?iri=not-a-url"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Missing or invalid iri" });
    expect(mockedSparqlDescribe).not.toHaveBeenCalled();
  });

  it("runs DESCRIBE query and returns payload", async () => {
    mockedSparqlDescribe.mockResolvedValue({
      contentType: "text/turtle",
      body: [
        "@prefix ex: <https://example.org/> .",
        "<https://example.org/s> <https://example.org/p> \"v\" .",
      ].join("\n"),
    });

    const iri = "http://upbkg.data.dice-research.org/ror/058kzsd48/faculty-eim";
    const response = await GET(new Request(`http://localhost/api/describe?iri=${encodeURIComponent(iri)}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      iri,
      contentType: "text/turtle",
      body: [
        "@prefix ex: <https://example.org/> .",
        "<https://example.org/s> <https://example.org/p> \"v\" .",
      ].join("\n"),
      prefixes: { ex: "https://example.org/" },
      parseError: null,
    });
    expect(Array.isArray(body.quads)).toBe(true);
    expect(body.quads).toHaveLength(1);
    expect(body.quads[0]).toMatchObject({
      subject: { termType: "NamedNode", value: "https://example.org/s" },
      predicate: { termType: "NamedNode", value: "https://example.org/p" },
      object: { termType: "Literal", value: "v" },
    });
    expect(mockedSparqlDescribe).toHaveBeenCalledTimes(1);
    expect(mockedSparqlDescribe).toHaveBeenCalledWith(`DESCRIBE <${iri}>`);
  });

  it("accepts uri alias and canonicalizes known upbkg paths", async () => {
    mockedSparqlDescribe.mockResolvedValue({
      contentType: "application/n-triples",
      body: "",
    });

    const iri = "http://131.234.26.202:3001/id/person/hash/63fa35093706";
    const response = await GET(new Request(`http://localhost/api/describe?uri=${encodeURIComponent(iri)}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.iri).toBe("http://upbkg.data.dice-research.org/id/person/hash/63fa35093706");
    expect(mockedSparqlDescribe).toHaveBeenCalledWith(
      "DESCRIBE <http://upbkg.data.dice-research.org/id/person/hash/63fa35093706>",
    );
  });

  it("returns 500 when SPARQL fails", async () => {
    mockedSparqlDescribe.mockRejectedValue(new Error("SPARQL error 503: upstream failed"));

    const response = await GET(
      new Request("http://localhost/api/describe?iri=https%3A%2F%2Fexample.org%2Fresource%2F1"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "The data service is temporarily unavailable. Please try again in a moment.",
    });
  });
});
