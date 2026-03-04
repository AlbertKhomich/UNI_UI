import { describe, expect, it } from "vitest";
import { initialQueryFromLocation, toSearchQueryFromIri } from "./page";

describe("deep-link query mapping", () => {
  it("maps person and orcid IRIs to author-prefixed query", () => {
    expect(
      toSearchQueryFromIri("http://upbkg.data.dice-research.org/id/person/abc123"),
    ).toBe("a: http://upbkg.data.dice-research.org/id/person/abc123");
    expect(toSearchQueryFromIri("http://upbkg.data.dice-research.org/orcid/0000-0001")).toBe(
      "a: http://upbkg.data.dice-research.org/orcid/0000-0001",
    );
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
  });

  it("prefers explicit q parameter over uri/path mapping", () => {
    const q = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/id/person/p1",
      search: "?q=custom%20query&uri=http%3A%2F%2Fupbkg.data.dice-research.org%2Fid%2Forg%2Fo1",
    });
    expect(q).toBe("custom query");
  });

  it("uses uri/iri parameter when q is missing", () => {
    const q1 = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/",
      search:
        "?uri=http%3A%2F%2Fupbkg.data.dice-research.org%2Fid%2Fperson%2Fp1",
    });
    expect(q1).toBe("a: http://upbkg.data.dice-research.org/id/person/p1");

    const q2 = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/",
      search:
        "?iri=http%3A%2F%2Fupbkg.data.dice-research.org%2Fid%2Forg%2Fo1",
    });
    expect(q2).toBe("aff: http://upbkg.data.dice-research.org/id/org/o1");
  });

  it("maps non-root path to query when no params are present", () => {
    const q = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/id/publication/paper-123",
      search: "",
    });
    expect(q).toBe("http://upbkg.data.dice-research.org/id/publication/paper-123");
  });

  it("ignores api paths for initial query", () => {
    const q = initialQueryFromLocation({
      origin: "http://upbkg.data.dice-research.org",
      pathname: "/api/search",
      search: "",
    });
    expect(q).toBe("");
  });
});
