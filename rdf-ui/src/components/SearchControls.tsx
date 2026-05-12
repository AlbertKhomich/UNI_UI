"use client";

import type { RefObject } from "react";

type SearchPrefix = "a:" | "y:" | "aff:" | "c:";
type SearchYearRange = [string, string];

type SearchControlsProps = {
  canSearch: boolean;
  err: string | null;
  hasItems: boolean;
  loading: boolean;
  onApplyPrefix: (prefix: SearchPrefix) => void;
  onCopySparql: () => void;
  onQueryChange: (next: string) => void;
  onYearRangeChange: (next: SearchYearRange) => void;
  prefixButtonClass: string;
  query: string;
  searchInputClass: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  sparqlCopied: boolean;
  sparqlCopyDisabled: boolean;
  yearRange: SearchYearRange;
};

export default function SearchControls(props: SearchControlsProps) {
  const {
    canSearch,
    err,
    hasItems,
    loading,
    onApplyPrefix,
    onCopySparql,
    onQueryChange,
    onYearRangeChange,
    prefixButtonClass,
    query,
    searchInputClass,
    searchInputRef,
    sparqlCopied,
    sparqlCopyDisabled,
    yearRange,
  } = props;

  const [yearFrom, yearTo] = yearRange;
  const yearInputClass = `${prefixButtonClass} w-24 appearance-none text-center outline-none`;

  return (
    <>
      <input
        ref={searchInputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search paper title... (a:, aff:, c:)"
        className={searchInputClass}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="From year"
          placeholder="from"
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
          placeholder="to"
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

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("a:")}>
          author
        </button>
        <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("aff:")}>
          affiliation
        </button>
        <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("c:")}>
          country
        </button>
        <button
          type="button"
          className={`${prefixButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={sparqlCopyDisabled}
          onClick={onCopySparql}
        >
          {sparqlCopied ? "Copied" : "Copy SPARQL"}
        </button>
      </div>

      <div className="mt-3 min-h-6">
        {loading && <span>Searching...</span>}
        {err && <span className="text-red-600">{err}</span>}
        {!loading && !err && canSearch && !hasItems && <span>No results.</span>}
      </div>
    </>
  );
}
