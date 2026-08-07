"use client";

import { useState, type RefObject } from "react";
import { BiSolidZap } from "react-icons/bi";
import { FiSend, FiTrash2, FiUpload } from "react-icons/fi";
import { FaRegCopy } from "react-icons/fa";
import BeatLoader from "react-spinners/BeatLoader";
import MarkdownAnswer from "@/components/MarkdownAnswer";
import ToggleSwitch from "@/components/ToggleSwitch";

type SearchPrefix = "a:" | "y:" | "aff:" | "c:";
type SearchYearRange = [string, string];
type RagSource = {
  chunk_id?: string;
  href?: string;
  label?: string;
  document_id?: string;
  filename?: string;
  page?: number;
};

type SearchControlsProps = {
  aiAnswer: string;
  clearingAttachments: boolean;
  aiDocumentStatus: string;
  aiEnabled: boolean;
  aiError: string | null;
  aiLoading: boolean;
  aiSources: RagSource[];
  canSearch: boolean;
  err: string | null;
  hasItems: boolean;
  hasUploadedDocuments: boolean;
  loading: boolean;
  onApplyPrefix: (prefix: SearchPrefix) => void;
  onAskAi: () => void;
  onCopyAiAnswer: () => Promise<void>;
  onClearAttachments: () => void;
  onRequestUpload: () => void;
  onToggleAi: (enabled: boolean) => void;
  onUploadDocument: (files: File[]) => void;
  onQueryChange: (next: string) => void;
  onYearRangeChange: (next: SearchYearRange) => void;
  prefixButtonClass: string;
  query: string;
  searchInputClass: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  uploadDocumentsLoading: boolean;
  uploadDocumentsReady: boolean;
  yearRange: SearchYearRange;
};

export default function SearchControls(props: SearchControlsProps) {
  const {
    aiAnswer,
    clearingAttachments,
    aiDocumentStatus,
    aiEnabled,
    aiError,
    aiLoading,
    aiSources,
    canSearch,
    err,
    hasItems,
    hasUploadedDocuments,
    loading,
    onApplyPrefix,
    onAskAi,
    onCopyAiAnswer,
    onClearAttachments,
    onRequestUpload,
    onToggleAi,
    onUploadDocument,
    onQueryChange,
    onYearRangeChange,
    prefixButtonClass,
    query,
    searchInputClass,
    searchInputRef,
    uploadDocumentsLoading,
    uploadDocumentsReady,
    yearRange,
  } = props;

  const [yearFrom, yearTo] = yearRange;
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const yearInputClass = `${prefixButtonClass} w-24 appearance-none text-center outline-none`;
  const attachmentInFlight = ["uploading", "pending", "parsing", "chunking", "embedding"].includes(aiDocumentStatus);
  const showWorking = aiLoading || attachmentInFlight;
  const askDisabled = aiLoading || attachmentInFlight || query.trim().length === 0;

  async function handleCopyAnswer(): Promise<void> {
    try {
      await onCopyAiAnswer();
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  return (
    <>
      <input
        ref={searchInputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (!aiEnabled || event.key !== "Enter" || event.nativeEvent.isComposing || askDisabled) return;
          event.preventDefault();
          onAskAi();
        }}
        placeholder={aiEnabled ? "Ask the knowledge base..." : "Search paper title... (a:, aff:, c:)"}
        className={searchInputClass}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 pr-1">
          <ToggleSwitch checked={aiEnabled} onChange={onToggleAi} />
          <span
            className={`inline-flex items-center gap-1 text-sm font-medium transition-colors duration-300 ${
              aiEnabled ? "text-green-500" : "text-gray-500"
            }`}
          >
            <BiSolidZap aria-hidden="true" size={16} />
            AI
          </span>
        </div>

        {aiEnabled ? (
          <div key="ai" className="mode-panel-enter flex flex-wrap items-center gap-2">
            {uploadDocumentsReady ? (
              <label className={`${prefixButtonClass} inline-flex cursor-pointer items-center gap-2`}>
                <FiUpload aria-hidden="true" size={15} />
                <span>Upload documents</span>
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.txt,.md,.html,.htm,.docx"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length > 0) onUploadDocument(files);
                  }}
                />
              </label>
            ) : (
              <button
                type="button"
                className={`${prefixButtonClass} inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-50`}
                disabled={uploadDocumentsLoading}
                onClick={onRequestUpload}
              >
                <FiUpload aria-hidden="true" size={15} />
                <span>{uploadDocumentsLoading ? "Preparing upload..." : "Upload documents"}</span>
              </button>
            )}
            {hasUploadedDocuments ? (
              <button
                type="button"
                className={`${prefixButtonClass} inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-50`}
                disabled={clearingAttachments}
                onClick={onClearAttachments}
              >
                <FiTrash2 aria-hidden="true" size={15} />
                <span>{clearingAttachments ? "Clearing..." : "Clear attachments"}</span>
              </button>
            ) : null}
            <button
              type="button"
              className={`${prefixButtonClass} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={askDisabled}
              onClick={onAskAi}
            >
              <FiSend aria-hidden="true" size={15} />
              ask
            </button>
            {aiDocumentStatus ? (
              <span className="text-sm text-gray-500">{aiDocumentStatus}</span>
            ) : null}
          </div>
        ) : (
          <div key="filters" className="mode-panel-enter flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="From year"
                placeholder="YYYY"
                value={yearFrom}
                onChange={(event) => onYearRangeChange([event.target.value.replace(/\D/g, "").slice(0, 4), yearTo])}
                className={yearInputClass}
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="To year"
                placeholder="YYYY"
                value={yearTo}
                onChange={(event) => onYearRangeChange([yearFrom, event.target.value.replace(/\D/g, "").slice(0, 4)])}
                className={yearInputClass}
              />
              {(yearFrom || yearTo) ? (
                <button type="button" className={prefixButtonClass} onClick={() => onYearRangeChange(["", ""])}>
                  clear
                </button>
              ) : null}
            </div>
            <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("a:")}>
              author
            </button>
            <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("aff:")}>
              affiliation
            </button>
            <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("c:")}>
              country
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 min-h-6">
        {aiEnabled ? (
          <>
            {showWorking && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <BeatLoader color="#22c55e" size={8} speedMultiplier={0.85} />
                <span>Working...</span>
              </div>
            )}
            {aiError && <span className="text-red-600">{aiError}</span>}
            {aiAnswer ? (
              <div className="mt-2 whitespace-pre-wrap rounded-xl border border-gray-200 p-3 text-sm leading-6 dark:border-gray-700">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-800"
                    aria-label="Copy AI answer"
                    title="Copy AI answer"
                    onClick={() => void handleCopyAnswer()}
                  >
                    <FaRegCopy size={14} aria-hidden="true" />
                    <span>{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy"}</span>
                  </button>
                </div>
                <MarkdownAnswer
                  sources={aiSources}
                  tail={aiLoading ? <span className="ml-0.5 animate-pulse">▍</span> : undefined}
                  text={aiAnswer}
                />
              </div>
            ) : null}
          </>
        ) : (
          <>
            {loading && <span>Searching...</span>}
            {err && <span className="text-red-600">{err}</span>}
            {!loading && !err && canSearch && !hasItems && <span>No results.</span>}
          </>
        )}
      </div>
    </>
  );
}
