"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiMoon, FiSun } from "react-icons/fi";
import DescribeResultPanel from "@/components/DescribeResultPanel";
import PaperResultsList from "@/components/PaperResultsList";
import SearchControls from "@/components/SearchControls";
import UsersByCountryWidget from "@/components/CountryWidget";
import { useDescribeState } from "@/hooks/useDescribeState";
import { useCountryStats } from "@/hooks/useCountryStats";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchState } from "@/hooks/useSearchState";
import { useTheme } from "@/hooks/useTheme";
import {
  canonicalizeUpbkgIri,
  extractDirectAuthorIri,
  getKnownAuthorNameByIriVariants,
  initialDescribeIriFromLocation,
  initialQueryFromLocation,
  toSearchQueryFromIri,
} from "@/lib/query";

export { initialDescribeIriFromLocation, initialQueryFromLocation, toSearchQueryFromIri };

function toPossessive(name: string): string {
  const n = name.trim();
  if (!n) return "Author's";
  if (/[sS]$/.test(n)) return `${n}'`;
  return `${n}'s`;
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [describeIri, setDescribeIri] = useState<string | null>(null);
  const dq = useDebounce(q, 400);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { isDark, setTheme, theme } = useTheme();
  const {
    countryErr,
    countryLoading,
    countryRowsWithColors,
    totalPapers,
  } = useCountryStats(theme);

  const activeAuthorIri = useMemo(() => {
    const iri = extractDirectAuthorIri(q);
    return iri ? canonicalizeUpbkgIri(iri) : null;
  }, [q]);

  const debouncedAuthorIri = useMemo(() => {
    const iri = extractDirectAuthorIri(dq);
    return iri ? canonicalizeUpbkgIri(iri) : null;
  }, [dq]);

  const {
    canSearch,
    details,
    detailsErr,
    detailsLoading,
    err,
    hasMore,
    items,
    knownAuthorNames,
    loadMoreRef,
    loading,
    loadingMore,
    openIds,
    rememberAuthorName,
    searchTotal,
    togglePaperOpen,
  } = useSearchState({
    debouncedQuery: dq,
    debouncedAuthorIri,
  });
  const {
    body: describeBody,
    contentType: describeContentType,
    error: describeError,
    loading: describeLoading,
    parseError: describeParseError,
    prefixes: describePrefixes,
    quads: describeQuads,
  } = useDescribeState({ iri: describeIri });

  const activeAuthorName = useMemo(
    () => (activeAuthorIri ? getKnownAuthorNameByIriVariants(knownAuthorNames, activeAuthorIri) : ""),
    [activeAuthorIri, knownAuthorNames],
  );

  const headingText = activeAuthorIri && activeAuthorName
    ? `${toPossessive(activeAuthorName)} Papers | Total: ${searchTotal}`
    : "Papers";

  const subtleTextClass = isDark ? "text-gray-400" : "text-gray-500";
  const searchInputClass = isDark
    ? "w-full rounded-xl border border-gray-500 bg-transparent px-3 py-3 text-base outline-none focus:border-gray-300"
    : "w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base outline-none focus:border-gray-500";
  const prefixButtonClass = isDark
    ? "rounded-xl border border-gray-500 bg-transparent px-3 py-1.5 text-sm transition-colors hover:bg-gray-800"
    : "rounded-xl border border-gray-300 bg-transparent px-3 py-1.5 text-sm transition-colors hover:bg-gray-100";
  const detailsClass = isDark
    ? "mt-3 border-t border-gray-600 pt-3 text-sm text-gray-300"
    : "mt-3 border-t border-gray-200 pt-3 text-sm text-gray-700";

  useEffect(() => {
    const nextQ = initialQueryFromLocation(window.location);
    const nextDescribeIri = initialDescribeIriFromLocation(window.location);
    if (!nextQ && !nextDescribeIri) return;
    const rafId = window.requestAnimationFrame(() => {
      setQ(nextQ);
      setDescribeIri(nextDescribeIri);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  function handleQueryChange(nextQuery: string): void {
    setDescribeIri(null);
    setQ(nextQuery);
  }

  function focusSearchInput(cursorPos: number): void {
    requestAnimationFrame(() => {
      const element = searchInputRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function applySearchPrefix(prefix: "a:" | "y:" | "aff:" | "c:"): void {
    const current = q.trimEnd();
    const separator = current.length > 0 ? " " : "";
    const next = `${current}${separator}${prefix} `;
    setDescribeIri(null);
    setQ(next);
    focusSearchInput(next.length);
  }

  function handleCountryClick(countryCode: string): void {
    const code = (countryCode || "").trim().toUpperCase();
    if (!code) return;
    const next = `c: ${code}`;
    setDescribeIri(null);
    setQ(next);
    focusSearchInput(next.length);
  }

  function handleAuthorSelect(authorIri: string, authorName: string): void {
    rememberAuthorName(authorIri, authorName);
    setDescribeIri(null);
    setQ(`a: ${authorIri}`);
  }

  return (
    <main className="mx-auto max-w-[900px] p-6 font-sans">
      <div className="mb-4 flex items-start justify-between">
        <a
          href="http://upbkg.data.dice-research.org/sparql"
          target="_blank"
          rel="noreferrer"
          className="inline-block"
        >
          <Image
            src="/sparql-96.png"
            alt="SPARQL endpoint"
            width={48}
            height={48}
            priority
          />
        </a>
        <button
          type="button"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
            isDark
              ? "border-gray-500 text-gray-100 hover:bg-gray-800"
              : "border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
          onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        >
          {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
        </button>
      </div>

      <div className="mb-6">
        {countryErr ? (
          <div className="mb-3 text-sm text-red-600">{countryErr}</div>
        ) : null}

        <UsersByCountryWidget
          rows={countryRowsWithColors}
          theme={theme}
          totalOverride={totalPapers}
          onCountryClick={handleCountryClick}
        />

        {countryLoading ? (
          <div className={`mt-2 text-xs ${subtleTextClass}`}>Loading countries...</div>
        ) : null}
      </div>

      <h1 className="mb-3 text-[26px] font-semibold">{headingText}</h1>

      <SearchControls
        canSearch={canSearch}
        err={err}
        hasItems={items.length > 0}
        loading={loading}
        onApplyPrefix={applySearchPrefix}
        onQueryChange={handleQueryChange}
        prefixButtonClass={prefixButtonClass}
        query={q}
        searchInputClass={searchInputClass}
        searchInputRef={searchInputRef}
      />

      {describeIri ? (
        <DescribeResultPanel
          body={describeBody}
          contentType={describeContentType}
          error={describeError}
          iri={describeIri}
          isDark={isDark}
          loading={describeLoading}
          parseError={describeParseError}
          prefixes={describePrefixes}
          quads={describeQuads}
        />
      ) : null}

      <PaperResultsList
        canSearch={canSearch}
        details={details}
        detailsClass={detailsClass}
        detailsErr={detailsErr}
        detailsLoading={detailsLoading}
        hasMore={hasMore}
        isDark={isDark}
        items={items}
        loadMoreRef={loadMoreRef}
        loadingMore={loadingMore}
        onSelectAuthor={handleAuthorSelect}
        onTogglePaperOpen={togglePaperOpen}
        openIds={openIds}
        subtleTextClass={subtleTextClass}
      />

      <div className="mt-18 flex items-center justify-center">
        <Link
          href="https://dice-research.org/"
          aria-label="Dice research group"
          rel="noreferrer"
          target="_blank"
        >
          <Image
            src="/logo.svg"
            alt="Dice group"
            width={110}
            height={55}
            priority
          />
        </Link>
      </div>
    </main>
  );
}
