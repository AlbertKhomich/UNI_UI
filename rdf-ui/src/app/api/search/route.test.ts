// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sparql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sparql")>();
  return {
    ...actual,
    sparqlSelect: vi.fn(),
  };
});

import { sparqlSelect } from "@/lib/sparql";
import type { SparqlRow } from "@/lib/sparql";
import { GET } from "./route";

const mockedSparqlSelect = vi.mocked(sparqlSelect);

describe("GET /api/search", () => {
  beforeEach(() => {
    mockedSparqlSelect.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty payload when query is missing", async () => {
    const response = await GET(new Request("http://localhost/api/search"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ items: [], total: 0, nextCursor: null });
    expect(mockedSparqlSelect).not.toHaveBeenCalled();
  });

  it("returns 400 for overly long queries", async () => {
    const q = "x".repeat(301);
    const response = await GET(new Request(`http://localhost/api/search?q=${q}`));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Querry too long" });
    expect(mockedSparqlSelect).not.toHaveBeenCalled();
  });

  it("supports direct RIS id search mode", async () => {
    const directRows: SparqlRow[] = [
      {
        paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/12345" },
        title: { type: "literal", value: "Graph Retrieval" },
        year: { type: "literal", value: "2024" },
        authors: { type: "literal", value: "Doe, Jane;Smith, John" },
        authorIris: {
          type: "literal",
          value:
            "http://upbkg.data.dice-research.org/id/author/hash/abc|http://upbkg.data.dice-research.org/id/author/uni/xyz",
        },
      },
    ];
    mockedSparqlSelect.mockResolvedValueOnce(directRows);

    const response = await GET(new Request("http://localhost/api/search?q=ris:12345"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.nextCursor).toBeNull();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "12345",
      title: "Graph Retrieval",
      authorsText: "Jane Doe, John Smith",
      authors: [
        { id: "abc", iri: "http://upbkg.data.dice-research.org/id/author/hash/abc" },
        { id: "xyz", iri: "http://upbkg.data.dice-research.org/id/author/uni/xyz" },
      ],
    });
    expect(mockedSparqlSelect).toHaveBeenCalledTimes(1);
  });

  it("supports direct publication URI search mode", async () => {
    const paperIri = "http://upbkg.data.dice-research.org/id/publication/abc-123";
    mockedSparqlSelect.mockResolvedValueOnce([
      {
        paper: { type: "uri", value: paperIri },
        title: { type: "literal", value: "UPBKG Paper" },
        year: { type: "literal", value: "2026" },
        authors: { type: "literal", value: "Doe, Jane" },
        authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/person/p1" },
      },
    ] as SparqlRow[]);

    const response = await GET(
      new Request(`http://localhost/api/search?q=${encodeURIComponent(paperIri)}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: paperIri,
      iri: paperIri,
      title: "UPBKG Paper",
    });
    const query = mockedSparqlSelect.mock.calls[0]?.[0] ?? "";
    expect(query).toContain(`BIND(<${paperIri}> AS ?paper)`);
    expect(mockedSparqlSelect).toHaveBeenCalledTimes(1);
  });

  it("supports direct venue URI search mode", async () => {
    const venueIri = "http://upbkg.data.dice-research.org/id/venue/d09d070e5ef7";
    mockedSparqlSelect.mockResolvedValueOnce([
      {
        paper: { type: "uri", value: venueIri },
        title: { type: "literal", value: "Venue Record" },
        year: { type: "literal", value: "2026" },
        authors: { type: "literal", value: "Doe, Jane" },
        authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/person/p1" },
      },
    ] as SparqlRow[]);

    const response = await GET(
      new Request(`http://localhost/api/search?q=${encodeURIComponent(venueIri)}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: venueIri,
      iri: venueIri,
      title: "Venue Record",
    });
    const query = mockedSparqlSelect.mock.calls[0]?.[0] ?? "";
    expect(query).toContain(`BIND(<${venueIri}> AS ?paper)`);
    expect(mockedSparqlSelect).toHaveBeenCalledTimes(1);
  });

  it("falls back from starts-with to contains title search", async () => {
    const queries: string[] = [];
    mockedSparqlSelect.mockImplementation(async (query: string) => {
      queries.push(query);

      if (query.includes("COUNT(DISTINCT ?paper)")) {
        return [{ total: { type: "literal", value: "1" } }];
      }

      if (query.includes("FILTER(STRSTARTS(LCASE(STR(?name))")) {
        return [];
      }

      return [
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/999" },
          title: { type: "literal", value: "Fallback Paper" },
          year: { type: "literal", value: "2023" },
          authors: { type: "literal", value: "Doe, Jane" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/a1" },
        },
      ] as SparqlRow[];
    });

    const response = await GET(new Request("http://localhost/api/search?q=fallback-title"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(mockedSparqlSelect).toHaveBeenCalledTimes(3);
    expect(queries.some((q) => q.includes("FILTER(STRSTARTS(LCASE(STR(?name))"))).toBe(true);
    expect(queries.some((q) => q.includes("FILTER(CONTAINS(LCASE(STR(?name))"))).toBe(true);
    expect(queries.some((q) => q.includes("COUNT(DISTINCT ?paper)"))).toBe(true);
  });

  it("applies tokenized title/author/year/affiliation/country filters", async () => {
    let searchQuery = "";
    let countQuery = "";

    mockedSparqlSelect.mockImplementation(async (query: string) => {
      if (query.includes("COUNT(DISTINCT ?paper)")) {
        countQuery = query;
        return [{ total: { type: "literal", value: "1" } }];
      }

      searchQuery = query;
      return [
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/420" },
          title: { type: "literal", value: "Knowledge Graph Methods" },
          year: { type: "literal", value: "2024" },
          authors: { type: "literal", value: "Doe, Jane" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/aa1" },
        },
      ] as SparqlRow[];
    });

    const raw = "knowledge graph a:Doe, Jane y:2024 aff:University of Bonn c:usa";
    const response = await GET(
      new Request(`http://localhost/api/search?q=${encodeURIComponent(raw)}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(searchQuery).toContain(
      'FILTER(STRSTARTS(LCASE(STR(?name)), LCASE("knowledge graph")))',
    );
    expect(searchQuery).toContain('FILTER(STR(?year0) = "2024")');
    expect(searchQuery).toContain(
      'FILTER(CONTAINS(LCASE(STR(?aaName1)), LCASE("Doe, Jane")))',
    );
    expect(searchQuery).toContain(
      'FILTER(CONTAINS(LCASE(STR(COALESCE(?affName2, ?aff2))), LCASE("University of Bonn")))',
    );
    expect(searchQuery).toMatch(/UCASE\(STR\(\?cc0\)\)\s+IN\s+\([^)]*"US"[^)]*\)/);
    expect(countQuery).toContain("COUNT(DISTINCT ?paper)");
  });

  it("treats author IRI token as a direct IRI filter", async () => {
    let searchQuery = "";
    let countQuery = "";

    mockedSparqlSelect.mockImplementation(async (query: string) => {
      if (query.includes("COUNT(DISTINCT ?paper)")) {
        countQuery = query;
        return [{ total: { type: "literal", value: "1" } }];
      }

      searchQuery = query;
      return [
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/421" },
          title: { type: "literal", value: "Semantic Retrieval" },
          year: { type: "literal", value: "2025" },
          authors: { type: "literal", value: "Doe, Jane" },
          authorIris: { type: "literal", value: "https://example.org/people/abc" },
        },
      ] as SparqlRow[];
    });

    const raw = "semantic retrieval a:https://example.org/people/abc";
    const response = await GET(
      new Request(`http://localhost/api/search?q=${encodeURIComponent(raw)}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(searchQuery).toContain('?paper schema:author <https://example.org/people/abc> .');
    expect(searchQuery).not.toContain("?aa schema:name ?aaName");
    expect(countQuery).toContain('?paper schema:author <https://example.org/people/abc> .');
  });

  it("uses cache within TTL and refreshes after TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    mockedSparqlSelect.mockImplementation(async (query: string) => {
      if (query.includes("COUNT(DISTINCT ?paper)")) {
        return [{ total: { type: "literal", value: "1" } }];
      }

      return [
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/cache-1" },
          title: { type: "literal", value: "Cache Validation Title" },
          year: { type: "literal", value: "2025" },
          authors: { type: "literal", value: "Doe, Jane" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/cachea" },
        },
      ] as SparqlRow[];
    });

    const url = "http://localhost/api/search?q=cache-validation-title";

    const first = await GET(new Request(url));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.total).toBe(1);
    expect(mockedSparqlSelect).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));
    const second = await GET(new Request(url));
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody).toEqual(firstBody);
    expect(mockedSparqlSelect).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    const third = await GET(new Request(url));
    const thirdBody = await third.json();
    expect(third.status).toBe(200);
    expect(thirdBody.total).toBe(1);
    expect(mockedSparqlSelect).toHaveBeenCalledTimes(4);
  });

  it("returns nextCursor and uses cursor filter on follow-up page", async () => {
    const searchQueries: string[] = [];
    mockedSparqlSelect.mockImplementation(async (query: string) => {
      if (query.includes("COUNT(DISTINCT ?paper)")) {
        return [{ total: { type: "literal", value: "3" } }];
      }

      searchQueries.push(query);
      const hasCursorFilter = query.includes("HAVING (") && query.includes("STR(?paper) >");
      if (hasCursorFilter) {
        return [
          {
            paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/3" },
            title: { type: "literal", value: "Gamma" },
            cursorNameSort: { type: "literal", value: "gamma" },
            year: { type: "literal", value: "2023" },
            authors: { type: "literal", value: "Gamma, Gina" },
            authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/g3" },
          },
        ] as SparqlRow[];
      }

      return [
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/1" },
          title: { type: "literal", value: "Alpha" },
          cursorNameSort: { type: "literal", value: "alpha" },
          year: { type: "literal", value: "2025" },
          authors: { type: "literal", value: "Alpha, Ann" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/a1" },
        },
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/2" },
          title: { type: "literal", value: "Beta" },
          cursorNameSort: { type: "literal", value: "beta" },
          year: { type: "literal", value: "2024" },
          authors: { type: "literal", value: "Beta, Ben" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/b2" },
        },
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/3" },
          title: { type: "literal", value: "Gamma" },
          cursorNameSort: { type: "literal", value: "gamma" },
          year: { type: "literal", value: "2023" },
          authors: { type: "literal", value: "Gamma, Gina" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/g3" },
        },
      ] as SparqlRow[];
    });

    const first = await GET(new Request("http://localhost/api/search?q=alpha&limit=2"));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.items).toHaveLength(2);
    expect(firstBody.total).toBe(3);
    expect(typeof firstBody.nextCursor).toBe("string");

    const second = await GET(
      new Request(
        `http://localhost/api/search?q=alpha&limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      ),
    );
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.items).toHaveLength(1);
    expect(secondBody.total).toBe(3);
    expect(secondBody.nextCursor).toBeNull();
    expect(searchQueries.some((q) => q.includes("HAVING (") && q.includes("STR(?paper) >"))).toBe(
      true,
    );
  });

  it("stabilizes page ordering before slicing and cursor encoding", async () => {
    mockedSparqlSelect.mockImplementation(async (query: string) => {
      if (query.includes("COUNT(DISTINCT ?paper)")) {
        return [{ total: { type: "literal", value: "3" } }];
      }

      return [
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/2" },
          title: { type: "literal", value: "Beta" },
          cursorNameSort: { type: "literal", value: "beta" },
          year: { type: "literal", value: "2024" },
          authors: { type: "literal", value: "Beta, Ben" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/b2" },
        },
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/1" },
          title: { type: "literal", value: "Alpha" },
          cursorNameSort: { type: "literal", value: "alpha" },
          year: { type: "literal", value: "2025" },
          authors: { type: "literal", value: "Alpha, Ann" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/a1" },
        },
        {
          paper: { type: "uri", value: "http://upbkg.data.dice-research.org/id/publication/ris/3" },
          title: { type: "literal", value: "Gamma" },
          cursorNameSort: { type: "literal", value: "gamma" },
          year: { type: "literal", value: "2023" },
          authors: { type: "literal", value: "Gamma, Gina" },
          authorIris: { type: "literal", value: "http://upbkg.data.dice-research.org/id/author/hash/g3" },
        },
      ] as SparqlRow[];
    });

    const response = await GET(new Request("http://localhost/api/search?q=alpha&limit=2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.title).toBe("Alpha");
    expect(body.items[1]?.title).toBe("Beta");

    const decodedCursor = JSON.parse(
      Buffer.from(String(body.nextCursor), "base64url").toString("utf8"),
    ) as { nameSort: string; paper: string };
    expect(decodedCursor).toEqual({
      nameSort: "beta",
      paper: "http://upbkg.data.dice-research.org/id/publication/ris/2",
    });
  });
});
