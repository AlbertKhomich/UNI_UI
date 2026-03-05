import { describe, expect, it } from "vitest";
import { parseDescribeBodyWithN3 } from "./rdf";

describe("parseDescribeBodyWithN3", () => {
  it("parses turtle triples and extracts prefixes", () => {
    const body = [
      "@prefix ex: <https://example.org/> .",
      "ex:s ex:p \"value\" .",
    ].join("\n");

    const parsed = parseDescribeBodyWithN3(body, "text/turtle; charset=utf-8");
    expect(parsed).not.toBeNull();
    expect(parsed?.parseError).toBeNull();
    expect(parsed?.prefixes).toEqual({ ex: "https://example.org/" });
    expect(parsed?.quads).toHaveLength(1);
    expect(parsed?.quads[0]).toMatchObject({
      subject: { termType: "NamedNode", value: "https://example.org/s" },
      predicate: { termType: "NamedNode", value: "https://example.org/p" },
      object: { termType: "Literal", value: "value" },
    });
  });

  it("returns null for non-n3 parseable formats", () => {
    const parsed = parseDescribeBodyWithN3('{"@id":"https://example.org/s"}', "application/ld+json");
    expect(parsed).toBeNull();
  });

  it("returns parse error for invalid parseable rdf payload", () => {
    const parsed = parseDescribeBodyWithN3("@prefix ex: <https://example.org/>", "text/turtle");
    expect(parsed).not.toBeNull();
    expect(parsed?.quads).toEqual([]);
    expect(typeof parsed?.parseError).toBe("string");
  });
});
