// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sparql", () => ({
  sparqlSelect: vi.fn(),
}));

import { sparqlSelect } from "@/lib/sparql";
import type { SparqlRow } from "@/lib/sparql";
import { getCountries } from "./topCountries";

const mockedSparqlSelect = vi.mocked(sparqlSelect);

describe("getCountries", () => {
  beforeEach(() => {
    mockedSparqlSelect.mockReset();
  });

  it("aggregates distinct papers by canonical country codes", async () => {
    const countryRows: SparqlRow[] = [
      {
        paper: { type: "uri", value: "paper-1" },
        aff: { type: "uri", value: "aff-1" },
        cc: { type: "literal", value: "US" },
      },
      {
        paper: { type: "uri", value: "paper-1" },
        aff: { type: "uri", value: "aff-1" },
        cc: { type: "literal", value: "us" },
      },
      {
        paper: { type: "uri", value: "paper-1" },
        aff: { type: "uri", value: "aff-2" },
        cc: { type: "literal", value: "DE" },
      },
      {
        paper: { type: "uri", value: "paper-2" },
        aff: { type: "uri", value: "aff-3" },
        cc: { type: "literal", value: "DE" },
      },
      {
        paper: { type: "uri", value: "paper-2" },
        aff: { type: "uri", value: "aff-3" },
        cc: { type: "literal", value: "FR" },
      },
      {
        paper: { type: "uri", value: "paper-3" },
        aff: { type: "uri", value: "aff-4" },
        cc: { type: "literal", value: "USA" },
      },
    ];
    const totalRows: SparqlRow[] = [{ totalPapers: { type: "literal", value: "7" } }];

    mockedSparqlSelect
      .mockResolvedValueOnce(countryRows)
      .mockResolvedValueOnce(totalRows);

    const result = await getCountries();

    expect(result.totalPapers).toBe(7);
    expect(result.rows[0]).toEqual({ name: "DE", value: 2 });
    expect(result.rows).toEqual(
      expect.arrayContaining([
        { name: "US", value: 1 },
        { name: "FR", value: 1 },
      ]),
    );
    expect(result.rows.some((row) => row.name === "USA")).toBe(false);
  });

  it("falls back totalPapers to zero when count query is not numeric", async () => {
    const countryRows: SparqlRow[] = [];
    const totalRows: SparqlRow[] = [{ totalPapers: { type: "literal", value: "n/a" } }];

    mockedSparqlSelect
      .mockResolvedValueOnce(countryRows)
      .mockResolvedValueOnce(totalRows);

    const result = await getCountries();

    expect(result.totalPapers).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("adds the Sammelband exclusion to both SPARQL queries", async () => {
    mockedSparqlSelect
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ totalPapers: { type: "literal", value: "0" } }]);

    await getCountries();

    const countriesQuery = mockedSparqlSelect.mock.calls[0]?.[0] ?? "";
    const totalQuery = mockedSparqlSelect.mock.calls[1]?.[0] ?? "";

    expect(countriesQuery).toContain("http://upbkg.data.dice-research.org/vocab/publicationType");
    expect(countriesQuery).toContain('"sammelband"');
    expect(totalQuery).toContain("http://upbkg.data.dice-research.org/vocab/publicationType");
    expect(totalQuery).toContain('"sammelband"');
  });
});
