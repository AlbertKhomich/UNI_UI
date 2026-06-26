"use client";

import type { RefObject } from "react";
import { BiSolidZap } from "react-icons/bi";
import { FiSend, FiUpload } from "react-icons/fi";
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
  aiDocumentStatus: string;
  aiEnabled: boolean;
  aiError: string | null;
  aiLoading: boolean;
  aiSources: RagSource[];
  canSearch: boolean;
  err: string | null;
  hasItems: boolean;
  loading: boolean;
  onApplyPrefix: (prefix: SearchPrefix) => void;
  onAskAi: () => void;
  onToggleAi: (enabled: boolean) => void;
  onUploadDocument: (files: File[]) => void;
  onQueryChange: (next: string) => void;
  onYearRangeChange: (next: SearchYearRange) => void;
  prefixButtonClass: string;
  query: string;
  searchInputClass: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  yearRange: SearchYearRange;
};

export default function SearchControls(props: SearchControlsProps) {
  const {
    aiAnswer,
    aiDocumentStatus,
    aiEnabled,
    aiError,
    aiLoading,
    aiSources,
    canSearch,
    err,
    hasItems,
    loading,
    onApplyPrefix,
    onAskAi,
    onToggleAi,
    onUploadDocument,
    onQueryChange,
    onYearRangeChange,
    prefixButtonClass,
    query,
    searchInputClass,
    searchInputRef,
    yearRange,
  } = props;

  const [yearFrom, yearTo] = yearRange;
  const yearInputClass = `${prefixButtonClass} w-24 appearance-none text-center outline-none`;
  const attachmentInFlight = ["uploading", "pending", "parsing", "chunking", "embedding"].includes(aiDocumentStatus);
  const showWorking = aiLoading || attachmentInFlight;
  const askDisabled = aiLoading || attachmentInFlight || query.trim().length === 0;

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
                <MarkdownAnswer sources={aiSources} text={aiAnswer} />
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
