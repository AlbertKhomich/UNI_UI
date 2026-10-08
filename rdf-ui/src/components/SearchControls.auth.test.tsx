import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchControls from "./SearchControls";

afterEach(cleanup);

function renderAiControls(overrides: Partial<React.ComponentProps<typeof SearchControls>> = {}) {
  const props: React.ComponentProps<typeof SearchControls> = {
    aiAnswer: "",
    clearingAttachments: false,
    aiDocumentStatus: "",
    aiEnabled: true,
    aiError: null,
    aiLoading: false,
    aiSessionReady: true,
    aiSessionError: false,
    onRetryAiSession: vi.fn(),
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
    onToggleTrr318: vi.fn(),
    trr318Enabled: false,
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


describe("AI session readiness", () => {
  it("blocks clicks and Enter while preparing a session", async () => {
    const user = userEvent.setup();
    const props = renderAiControls({ query: "Question", aiSessionReady: false });
    expect(screen.getByRole("button", { name: "ask" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "ask" }));
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(props.onAskAi).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Preparing AI");
  });

  it("allows asking after setup completes", async () => {
    const user = userEvent.setup();
    const props = renderAiControls({ query: "Question" });
    await user.click(screen.getByRole("button", { name: "ask" }));
    expect(props.onAskAi).toHaveBeenCalledOnce();
  });

  it("offers retry when setup fails", async () => {
    const user = userEvent.setup();
    const props = renderAiControls({ query: "Question", aiSessionReady: false, aiSessionError: true });
    await user.click(screen.getByRole("button", { name: "Retry AI setup" }));
    expect(props.onRetryAiSession).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "ask" })).toBeDisabled();
  });
});
