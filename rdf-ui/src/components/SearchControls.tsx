"use client";

import type { RefObject } from "react";

type SearchPrefix = "a:" | "y:" | "aff:" | "c:";

type SearchControlsProps = {
  canSearch: boolean;
  err: string | null;
  hasItems: boolean;
  loading: boolean;
  onApplyPrefix: (prefix: SearchPrefix) => void;
  onQueryChange: (next: string) => void;
  prefixButtonClass: string;
  query: string;
  searchInputClass: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
};

export default function SearchControls(props: SearchControlsProps) {
  const {
    canSearch,
    err,
    hasItems,
    loading,
    onApplyPrefix,
    onQueryChange,
    prefixButtonClass,
    query,
    searchInputClass,
    searchInputRef,
  } = props;

  return (
    <>
      <input
        ref={searchInputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search paper title... (a:, y:, aff:, c:)"
        className={searchInputClass}
      />

      <div className="mt-2 flex gap-2">
        <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("a:")}>
          author
        </button>
        <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("y:")}>
          year
        </button>
        <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("aff:")}>
          affiliation
        </button>
        <button type="button" className={prefixButtonClass} onClick={() => onApplyPrefix("c:")}>
          country
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
