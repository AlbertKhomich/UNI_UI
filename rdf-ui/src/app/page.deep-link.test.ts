import { describe, expect, it } from "vitest";
import {
  initialDescribeIriFromLocation,
  initialQueryFromLocation,
  toSearchQueryFromIri,
} from "./page";

describe("deep-link query mapping", () => {
  it("maps person and orcid IRIs to author-prefixed query", () => {
    expect(
      toSearchQueryFromIri("http://upbkg.data.dice-research.org/id/person/abc123"),
    ).toBe("a: http://upbkg.data.dice-research.org/id/person/abc123");
    expect(toSearchQueryFromIri("http://upbkg.data.dice-research.org/orcid/0000-0001")).toBe(
      "a: http://upbkg.data.dice-research.org/orcid/0000-0001",
    );
    expect(
      toSearchQueryFromIri("http://131.234.26.202:3001/id/person/hash/63fa35093706"),
    ).toBe("a: http://upbkg.data.dice-research.org/id/person/hash/63fa35093706");
  });

  it("maps organization IRIs to affiliation-prefixed query", () => {
    expect(toSearchQueryFromIri("http://upbkg.data.dice-research.org/id/org/u1")).toBe(
      "aff: http://upbkg.data.dice-research.org/id/org/u1",
    );
    expect(toSearchQueryFromIri("http://upbkg.data.dice-research.org/ror/01x")).toBe(
      "aff: http://upbkg.data.dice-research.org/ror/01x",
    );
    expect(toSearchQueryFromIri("http://upbkg.data.dice-research.org/openalex_org/o1")).toBe(
      "aff: http://upbkg.data.dice-research.org/openalex_org/o1",
    );
  });

  it("keeps publication and venue IRIs as plain query", () => {
    expect(
      toSearchQueryFromIri("http://upbkg.data.dice-research.org/id/publication/paper-1"),
    ).toBe("http://upbkg.data.dice-research.org/id/publication/paper-1");
    expect(toSearchQueryFromIri("http://upbkg.data.dice-research.org/id/venue/venue-1")).toBe(
      "http://upbkg.data.dice-research.org/id/venue/venue-1",
    );
    expect(toSearchQueryFromIri("http://131.234.26.202:3001/id/venue/venue-1")).toBe(
      "http://upbkg.data.dice-research.org/id/venue/venue-1",
    );
  });

  it("prefers explicit q parameter over uri/path mapping", () => {
    const q = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/id/person/p1",
      search: "?q=custom%20query&uri=http%3A%2F%2Fupbkg.data.dice-research.org%2Fid%2Forg%2Fo1",
    });
    expect(q).toBe("custom query");

    const iri = initialDescribeIriFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/id/person/p1",
      search: "?q=custom%20query&uri=http%3A%2F%2Fupbkg.data.dice-research.org%2Fid%2Forg%2Fo1",
    });
    expect(iri).toBeNull();
  });

  it("uses q parameter only for initial search", () => {
    const q = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/id/publication/paper-123",
      search: "?q=graph%20neural",
    });
    expect(q).toBe("graph neural");

    const empty = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/id/publication/paper-123",
      search: "",
    });
    expect(empty).toBe("");
  });

  it("disables auto-search when q contains direct uri filters and prefers describe mode", () => {
    const q = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/",
      search: "?q=aff%3A%20http%3A%2F%2Fupbkg.data.dice-research.org%2Fror%2F058kzsd48%2Ffaculty-eim",
    });
    expect(q).toBe("");

    const iri = initialDescribeIriFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/",
      search: "?q=aff%3A%20http%3A%2F%2Fupbkg.data.dice-research.org%2Fror%2F058kzsd48%2Ffaculty-eim",
    });
    expect(iri).toBe("http://upbkg.data.dice-research.org/ror/058kzsd48/faculty-eim");
  });

  it("uses uri/iri parameter for describe when q is missing", () => {
    const iri1 = initialDescribeIriFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/",
      search:
        "?uri=http%3A%2F%2Fupbkg.data.dice-research.org%2Fid%2Fperson%2Fp1",
    });
    expect(iri1).toBe("http://upbkg.data.dice-research.org/id/person/p1");

    const iri2 = initialDescribeIriFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/",
      search:
        "?iri=http%3A%2F%2Fupbkg.data.dice-research.org%2Fid%2Forg%2Fo1",
    });
    expect(iri2).toBe("http://upbkg.data.dice-research.org/id/org/o1");
  });

  it("maps non-root rdf path to describe iri when no params are present", () => {
    const iri = initialDescribeIriFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/id/publication/paper-123",
      search: "",
    });
    expect(iri).toBe("http://upbkg.data.dice-research.org/id/publication/paper-123");
  });

  it("canonicalizes non-root path host for describe iri", () => {
    const iri = initialDescribeIriFromLocation({
      origin: "http://131.234.26.202:3001",
      pathname: "/id/person/hash/63fa35093706",
      search: "",
    });
    expect(iri).toBe("http://upbkg.data.dice-research.org/id/person/hash/63fa35093706");
  });

  it("ignores api paths for describe iri", () => {
    const apiIri = initialDescribeIriFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/api/search",
      search: "",
    });
    expect(apiIri).toBeNull();
  });

  it("maps non-api path to describe iri for browse-first navigation", () => {
    const iri = initialDescribeIriFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/wikidata/Q133163755",
      search: "",
    });
    expect(iri).toBe("http://upbkg.data.dice-research.org/wikidata/Q133163755");
  });

  it("canonicalizes non-api path host for browse-first navigation", () => {
    const iri = initialDescribeIriFromLocation({
      origin: "http://131.234.26.202:3001",
      pathname: "/wikidata/Q133163755",
      search: "",
    });
    expect(iri).toBe("http://upbkg.data.dice-research.org/wikidata/Q133163755");
  });
});
