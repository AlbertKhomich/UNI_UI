import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchControls from "./SearchControls";

function renderAiControls(overrides: Partial<React.ComponentProps<typeof SearchControls>> = {}) {
  const props: React.ComponentProps<typeof SearchControls> = {
    aiAnswer: "",
    clearingAttachments: false,
    aiDocumentStatus: "",
    aiEnabled: true,
    aiError: null,
    aiLoading: false,
    aiSources: [],
    canSearch: false,
    err: null,
    hasItems: false,
    hasUploadedDocuments: false,
    loading: false,
    onApplyPrefix: vi.fn(),
    onAskAi: vi.fn(),
    onCopyAiAnswer: vi.fn(),
    onClearAttachments: vi.fn(),
    onQueryChange: vi.fn(),
    onRequestUpload: vi.fn(),
    onToggleAi: vi.fn(),
    onUploadDocument: vi.fn(),
    onYearRangeChange: vi.fn(),
    prefixButtonClass: "button",
    query: "",
    searchInputClass: "input",
    searchInputRef: { current: null },
    uploadDocumentsLoading: false,
    uploadDocumentsReady: false,
    yearRange: ["", ""],
    ...overrides,
  };

  render(<SearchControls {...props} />);
  return props;
}

describe("SearchControls upload authorization", () => {
  it("requests authentication instead of opening a file input when upload is unavailable", async () => {
    const user = userEvent.setup();
    const props = renderAiControls();

    await user.click(screen.getByRole("button", { name: "Upload documents" }));

    expect(props.onRequestUpload).toHaveBeenCalledOnce();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("enables the original file upload behavior after the user's RAG session is ready", async () => {
    const user = userEvent.setup();
    const props = renderAiControls({ uploadDocumentsReady: true });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["paper"], "paper.txt", { type: "text/plain" });

    await user.upload(input, file);

    expect(props.onUploadDocument).toHaveBeenCalledWith([file]);
    expect(props.onRequestUpload).not.toHaveBeenCalled();
  });

  it("shows clear attachments only when the documents endpoint found documents", async () => {
    const user = userEvent.setup();
    const props = renderAiControls({
      hasUploadedDocuments: true,
      uploadDocumentsReady: true,
    });

    await user.click(screen.getByRole("button", { name: "Clear attachments" }));

    expect(props.onClearAttachments).toHaveBeenCalledOnce();
  });
});
