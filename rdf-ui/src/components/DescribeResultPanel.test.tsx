import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DescribeResultPanel from "./DescribeResultPanel";
import type { DescribeQuad } from "@/lib/types";

describe("DescribeResultPanel", () => {
  it("renders clickable compacted IRIs from parsed N3 triples", () => {
    const body = [
      "@prefix ror: <https://ror.org/> .",
      "<http://upbkg.data.dice-research.org/ror/058kzsd48/faculty-eim> <https://schema.org/name> \"Faculty EIM\" .",
      "ror:058kzsd48 <https://schema.org/url> <https://ror.org/058kzsd48> .",
    ].join("\n");
    const quads: DescribeQuad[] = [
      {
        subject: {
          termType: "NamedNode",
          value: "http://upbkg.data.dice-research.org/ror/058kzsd48/faculty-eim",
        },
        predicate: {
          termType: "NamedNode",
          value: "https://schema.org/name",
        },
        object: {
          termType: "Literal",
          value: "Faculty EIM",
          datatype: "http://www.w3.org/2001/XMLSchema#string",
        },
      },
      {
        subject: {
          termType: "NamedNode",
          value: "https://ror.org/058kzsd48",
        },
        predicate: {
          termType: "NamedNode",
          value: "https://schema.org/url",
        },
        object: {
          termType: "NamedNode",
          value: "https://ror.org/058kzsd48",
        },
      },
    ];

    render(
      <DescribeResultPanel
        body={body}
        contentType="text/turtle"
        error={null}
        iri="http://upbkg.data.dice-research.org/ror/058kzsd48/faculty-eim"
        isDark={false}
        loading={false}
        parseError={null}
        prefixes={{ ror: "https://ror.org/" }}
        quads={quads}
      />,
    );

    const rorLinks = screen.getAllByRole("link", { name: "ror:058kzsd48" });
    expect(rorLinks.length).toBeGreaterThan(0);
    expect(rorLinks.every((link) => link.getAttribute("href") === "https://ror.org/058kzsd48")).toBe(true);
    const eimLinks = screen.getAllByRole("link", {
      name: "http://upbkg.data.dice-research.org/ror/058kzsd48/faculty-eim",
    });
    expect(eimLinks.length).toBeGreaterThan(0);
    expect(
      eimLinks.every(
        (link) => link.getAttribute("href") === "http://upbkg.data.dice-research.org/ror/058kzsd48/faculty-eim",
      ),
    ).toBe(true);
    expect(screen.getByText("2 triples")).toBeInTheDocument();
    expect(screen.getByText(/Content type: text\/turtle/)).toBeInTheDocument();
  });

  it("shows a map section when describe quads contain coordinates", () => {
    const iri = "https://example.org/affiliations/geo";
    const quads: DescribeQuad[] = [
      {
        subject: { termType: "NamedNode", value: iri },
        predicate: { termType: "NamedNode", value: "https://schema.org/name" },
        object: {
          termType: "Literal",
          value: "Geo Institute",
          datatype: "http://www.w3.org/2001/XMLSchema#string",
        },
      },
      {
        subject: { termType: "NamedNode", value: iri },
        predicate: { termType: "NamedNode", value: "https://schema.org/latitude" },
        object: { termType: "Literal", value: "51.71892", datatype: "http://www.w3.org/2001/XMLSchema#decimal" },
      },
      {
        subject: { termType: "NamedNode", value: iri },
        predicate: { termType: "NamedNode", value: "https://schema.org/longitude" },
        object: { termType: "Literal", value: "8.75751", datatype: "http://www.w3.org/2001/XMLSchema#decimal" },
      },
    ];

    render(
      <DescribeResultPanel
        body=""
        contentType="application/ld+json"
        error={null}
        iri={iri}
        isDark={false}
        loading={false}
        parseError={null}
        prefixes={{}}
        quads={quads}
      />,
    );

    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(screen.getByLabelText("Map showing 1 location")).toBeInTheDocument();
    expect(screen.getByText("Geo Institute")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in OSM" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/?mlat=51.71892&mlon=8.75751#map=12/51.71892/8.75751",
    );
  });
});
