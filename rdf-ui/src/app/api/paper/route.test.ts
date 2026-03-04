// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sparql", () => ({
  sparqlSelect: vi.fn(),
}));

import { sparqlSelect } from "@/lib/sparql";
import type { SparqlRow } from "@/lib/sparql";
import { GET } from "./route";

const mockedSparqlSelect = vi.mocked(sparqlSelect);

describe("GET /api/paper", () => {
  beforeEach(() => {
    mockedSparqlSelect.mockReset();
  });

  it("returns 400 when id is missing", async () => {
    const response = await GET(new Request("http://localhost/api/paper"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Missing id" });
    expect(mockedSparqlSelect).not.toHaveBeenCalled();
  });

  it("returns 404 when paper is not found", async () => {
    mockedSparqlSelect.mockResolvedValueOnce([]);

    const response = await GET(new Request("http://localhost/api/paper?id=123"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
  });

  it("extracts DOI URL and deduplicates author affiliations", async () => {
    const paperRows: SparqlRow[] = [
      {
        paper: { type: "uri", value: "https://dice-research.org/id/publication/ris/123" },
        title: { type: "literal", value: "A Paper" },
        year: { type: "literal", value: "2025" },
        identifiers: { type: "literal", value: "DOI: 10.1000/xyz123|URN:foo" },
      },
    ];
    const authorRows: SparqlRow[] = [
      {
        a: { type: "uri", value: "https://example.org/author/1" },
        name: { type: "literal", value: "Doe, Jane" },
        orcid: { type: "literal", value: "https://orcid.org/0000-0000-0000-0001" },
        aff: { type: "uri", value: "https://example.org/aff/1" },
        affLabel: { type: "literal", value: "Uni One" },
        affRor: { type: "literal", value: "https://ror.org/01" },
        countryRaw: { type: "literal", value: "US" },
      },
      {
        a: { type: "uri", value: "https://example.org/author/1" },
        name: { type: "literal", value: "Doe, Jane" },
        aff: { type: "uri", value: "https://example.org/aff/1" },
        affLabel: { type: "literal", value: "Uni One" },
        countryRaw: { type: "literal", value: "CA" },
      },
      {
        a: { type: "uri", value: "https://example.org/author/1" },
        name: { type: "literal", value: "Doe, Jane" },
        aff: { type: "uri", value: "https://example.org/aff/2" },
        affLabel: { type: "literal", value: "Lab Two" },
        countryRaw: { type: "literal", value: "DE" },
      },
      {
        a: { type: "uri", value: "https://example.org/author/2" },
        name: { type: "literal", value: "Smith, John" },
      },
    ];

    mockedSparqlSelect
      .mockResolvedValueOnce(paperRows)
      .mockResolvedValueOnce(authorRows);

    const response = await GET(new Request("http://localhost/api/paper?id=123"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sameAs).toBe("https://doi.org/10.1000/xyz123");
    expect(body.authors).toEqual(["Jane Doe", "John Smith"]);
    expect(body.authorsDetailed).toHaveLength(2);

    const detailedAuthors = body.authorsDetailed as Array<{
      iri: string;
      affiliations: Array<{ iri: string; sameAs?: string; countryRaw?: string }>;
    }>;
    const jane = detailedAuthors.find((author) => author.iri === "https://example.org/author/1");
    expect(jane).toBeDefined();
    expect(jane.affiliations).toHaveLength(2);
    expect(jane.affiliations[0]).toMatchObject({
      iri: "https://example.org/aff/1",
      sameAs: "https://ror.org/01",
      countryRaw: "US",
    });
  });

  it("keeps sameAs null without a valid DOI and defaults optional arrays", async () => {
    const paperRows: SparqlRow[] = [
      {
        paper: { type: "uri", value: "https://dice-research.org/id/publication/ris/321" },
        title: { type: "literal", value: "No DOI Paper" },
        identifiers: { type: "literal", value: "ISBN: 12345|DOI: not-a-valid-doi" },
      },
    ];
    const authorRows: SparqlRow[] = [
      {
        a: { type: "uri", value: "https://example.org/author/9" },
        name: { type: "literal", value: "Doe, Jane" },
      },
    ];

    mockedSparqlSelect
      .mockResolvedValueOnce(paperRows)
      .mockResolvedValueOnce(authorRows);

    const response = await GET(new Request("http://localhost/api/paper?id=321"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sameAs).toBeNull();
    expect(body.keywords).toEqual([]);
    expect(body.fields).toEqual([]);
    expect(body.subfields).toEqual([]);
    expect(body.urls).toEqual([]);
    expect(body.codeRepositories).toEqual([]);
    expect(body.licenses).toEqual([]);
    expect(body.publisherNames).toEqual([]);
  });

  it("backfills affiliation metadata when duplicate affiliation appears later", async () => {
    const paperRows: SparqlRow[] = [
      {
        paper: { type: "uri", value: "https://dice-research.org/id/publication/ris/654" },
        title: { type: "literal", value: "Affiliation Merge Paper" },
      },
    ];
    const authorRows: SparqlRow[] = [
      {
        a: { type: "uri", value: "https://example.org/author/merge-1" },
        name: { type: "literal", value: "Doe, Jane" },
        aff: { type: "uri", value: "https://example.org/aff/merge-1" },
        affLabel: { type: "literal", value: "Merge University" },
      },
      {
        a: { type: "uri", value: "https://example.org/author/merge-1" },
        name: { type: "literal", value: "Doe, Jane" },
        aff: { type: "uri", value: "https://example.org/aff/merge-1" },
        affLabel: { type: "literal", value: "Merge University" },
        affRor: { type: "literal", value: "https://ror.org/merge-1" },
        countryRaw: { type: "literal", value: "DE" },
      },
    ];

    mockedSparqlSelect
      .mockResolvedValueOnce(paperRows)
      .mockResolvedValueOnce(authorRows);

    const response = await GET(new Request("http://localhost/api/paper?id=654"));
    const body = await response.json();

    expect(response.status).toBe(200);
    const detailedAuthors = body.authorsDetailed as Array<{
      iri: string;
      affiliations: Array<{ iri: string; sameAs?: string; countryRaw?: string }>;
    }>;
    const author = detailedAuthors.find(
      (entry) => entry.iri === "https://example.org/author/merge-1",
    );
    expect(author).toBeDefined();
    expect(author?.affiliations).toHaveLength(1);
    expect(author?.affiliations[0]).toMatchObject({
      iri: "https://example.org/aff/merge-1",
      sameAs: "https://ror.org/merge-1",
      countryRaw: "DE",
    });
  });
});
