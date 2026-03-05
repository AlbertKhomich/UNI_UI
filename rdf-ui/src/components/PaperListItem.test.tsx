import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaperListItem from "./PaperListItem";
import type { PaperDetails, SearchItem } from "@/lib/types";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img">) => React.createElement("img", props),
}));

const item: SearchItem = {
  id: "paper-1",
  iri: "http://example.org/paper-1",
  title: "Graph Paper",
  year: "2026",
  authorsText: "Alice Example",
};

const detail: PaperDetails = {
  id: item.id,
  iri: item.iri,
  title: item.title,
  subtitle: "Open details",
  authorsDetailed: [],
};

describe("PaperListItem", () => {
  it("triggers toggle on click and keyboard interaction", () => {
    const onTogglePaperOpen = vi.fn();

    render(
      <PaperListItem
        detail={detail}
        detailsClass="details"
        detailsError={undefined}
        isDark={false}
        isOpen={false}
        item={item}
        loadingDetails={false}
        onSelectAuthor={vi.fn()}
        onTogglePaperOpen={onTogglePaperOpen}
      />,
    );

    fireEvent.click(screen.getByText("Graph Paper"));
    expect(onTogglePaperOpen).toHaveBeenCalledWith("paper-1");

    const rowButton = screen.getByRole("button", { expanded: false });
    fireEvent.keyDown(rowButton, { key: "Enter" });
    fireEvent.keyDown(rowButton, { key: " " });
    expect(onTogglePaperOpen).toHaveBeenCalledTimes(3);
  });

  it("renders details only when row is open", () => {
    const { rerender } = render(
      <PaperListItem
        detail={detail}
        detailsClass="details"
        detailsError={undefined}
        isDark
        isOpen={false}
        item={item}
        loadingDetails={false}
        onSelectAuthor={vi.fn()}
        onTogglePaperOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText("Open details")).not.toBeInTheDocument();

    rerender(
      <PaperListItem
        detail={detail}
        detailsClass="details"
        detailsError={undefined}
        isDark
        isOpen
        item={item}
        loadingDetails={false}
        onSelectAuthor={vi.fn()}
        onTogglePaperOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Open details")).toBeInTheDocument();
  });
});
