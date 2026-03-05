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
});
