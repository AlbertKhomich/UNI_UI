import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaperDetailsPanel from "./PaperDetailsPanel";
import type { PaperDetails } from "@/lib/types";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img">) => React.createElement("img", props),
}));

function buildDetail(): PaperDetails {
  return {
    id: "paper-1",
    iri: "http://example.org/paper-1",
    title: "Graph Paper",
    subtitle: "A Useful Subtitle",
    abstract: "Detailed abstract",
    keywords: ["knowledge graph"],
    fields: ["Computer Science"],
    subfields: ["Semantic Web"],
    sameAs: "https://doi.org/10.1234/example",
    urls: [" https://example.org/paper.pdf ", "https://example.org/paper.pdf"],
    codeRepositories: [
      "https://github.com/acme/repo",
      "https://gitlab.com/acme/repo",
      "https://github.com/acme/repo",
    ],
    isPartOfNames: ["Journal of Graphs"],
    volume: "42",
    issue: "7",
    pageStart: "101",
    pageEnd: "120",
    authorsDetailed: [
      {
        iri: "http://example.org/person/alice",
        name: "Alice Example",
        orcid: "https://orcid.org/0000-0000-0000-0001",
        affiliations: [
          {
            name: "Example University",
            iri: "http://example.org/org/u1",
            sameAs: "https://ror.org/01abcde12",
            countryRaw: "DE",
          },
        ],
      },
    ],
  };
}

describe("PaperDetailsPanel", () => {
  it("renders loading and error states", () => {
    render(
      <PaperDetailsPanel
        detail={undefined}
        detailsClass="details"
        detailsError="Failed to load"
        isDark={false}
        loadingDetails
        onSelectAuthor={vi.fn()}
      />,
    );

    expect(screen.getByText("Loading details...")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load expanded paper information.");
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
  });

  it("renders details and emits author selection callback", () => {
    const onSelectAuthor = vi.fn();
    const detail = buildDetail();

    render(
      <PaperDetailsPanel
        detail={detail}
        detailsClass="details"
        detailsError={undefined}
        isDark
        loadingDetails={false}
        onSelectAuthor={onSelectAuthor}
      />,
    );

    expect(screen.getByText("A Useful Subtitle")).toBeInTheDocument();
    expect(screen.getByText("Journal of Graphs")).toBeInTheDocument();
    expect(screen.getByText("Vol. 42, Issue 7, pp. 101-120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DOI" })).toHaveAttribute("href", "https://doi.org/10.1234/example");
    expect(screen.getByRole("link", { name: "GitHub repository" })).toHaveAttribute("href", "https://github.com/acme/repo");
    expect(screen.getByRole("link", { name: "Repository" })).toHaveAttribute("href", "https://gitlab.com/acme/repo");
    expect(screen.getByRole("link", { name: "PDF file" })).toHaveAttribute("href", "https://example.org/paper.pdf");
    expect(screen.getByRole("link", { name: "Example University" })).toHaveAttribute("href", "https://ror.org/01abcde12");

    fireEvent.click(screen.getByRole("button", { name: "Alice Example" }));
    expect(onSelectAuthor).toHaveBeenCalledWith(
      "http://example.org/person/alice",
      "Alice Example",
    );
  });
});
