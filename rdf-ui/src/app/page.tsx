"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type SearchYearRange = [string, string];
type RagDocumentStatus = "idle" | "uploading" | "pending" | "parsing" | "chunking" | "embedding" | "indexed" | "failed";
type RagSource = {
  chunk_id?: string;
  href?: string;
  label?: string;
  document_id?: string;
  filename?: string;
  page?: number;
};

function toPossessive(name: string): string {
  const n = name.trim();
  if (!n) return "Author's";
  if (/[sS]$/.test(n)) return `${n}'`;
  return `${n}'s`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectDocumentStatuses(payload: unknown): string[] {
  if (isRecord(payload) && typeof payload.status === "string") return [payload.status.toLowerCase()];

  const source = isRecord(payload) && Array.isArray(payload.documents)
    ? payload.documents
    : Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.items)
        ? payload.items
        : [];

  return source
    .map((item) => (isRecord(item) && typeof item.status === "string" ? item.status.toLowerCase() : ""))
    .filter(Boolean);
}

function summarizeDocumentStatus(statuses: string[]): RagDocumentStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.length > 0 && statuses.every((status) => status === "indexed")) return "indexed";
  if (statuses.includes("embedding")) return "embedding";
  if (statuses.includes("chunking")) return "chunking";
  if (statuses.includes("parsing")) return "parsing";
  if (statuses.includes("pending")) return "pending";
  return "pending";
}

function isRagAttachmentInFlight(status: RagDocumentStatus): boolean {
  return ["uploading", "pending", "parsing", "chunking", "embedding"].includes(status);
}

function readAnswer(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!isRecord(payload)) return "";

  for (const key of ["answer", "response", "text", "message"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return JSON.stringify(payload, null, 2);
}

function readSources(payload: unknown): RagSource[] {
  if (!isRecord(payload)) return [];

  const documentSources = Array.isArray(payload.sources) ? payload.sources.flatMap((source) => {
    if (!isRecord(source) || typeof source.chunk_id !== "string" || !source.chunk_id.trim()) return [];

    return [{
      chunk_id: source.chunk_id.trim(),
      document_id: typeof source.document_id === "string" ? source.document_id : undefined,
      filename: typeof source.filename === "string" ? source.filename : undefined,
      page: typeof source.page === "number" ? source.page : undefined,
    }];
  }) : [];

  const citations = isRecord(payload.citations) ? payload.citations : null;
  const entities = citations && Array.isArray(citations.entities)
    ? citations.entities.filter((entity): entity is string => typeof entity === "string" && entity.trim().length > 0)
    : [];
  const triples = citations && typeof citations.triples === "number" ? citations.triples : 0;
  const graphSources: RagSource[] = [];

  if (triples > 0) graphSources.push({ label: `Triples (${triples})` });
  if (entities.length > 0) {
    graphSources.push({
      href: entities.length === 1 ? entities[0] : undefined,
      label: entities.length === 1 ? "Entity" : `Entities (${entities.length})`,
    });
  }

  return [...documentSources, ...graphSources];
}

async function readApiJson(response: Response, fallback: string): Promise<unknown> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
    throw new Error(message);
  }
  return payload;
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [yearRange, setYearRange] = useState<SearchYearRange>(["", ""]);
  const [describeIri, setDescribeIri] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDocumentStatus, setAiDocumentStatus] = useState<RagDocumentStatus>("idle");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSources, setAiSources] = useState<RagSource[]>([]);
  const dq = useDebounce(aiEnabled ? "" : q, 400);
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

  const yearFrom = yearRange[0].length === 4 ? yearRange[0] : "";
  const yearTo = yearRange[1].length === 4 ? yearRange[1] : "";

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
    yearFrom,
    yearTo,
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

  const headingText = aiEnabled
    ? "What would you like to know?"
    : activeAuthorIri && activeAuthorName
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
    if (aiEnabled) setAiError(null);
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

  function handleToggleAi(enabled: boolean): void {
    setAiEnabled(enabled);
    setDescribeIri(null);
    setQ("");
    setYearRange(["", ""]);
    setAiAnswer("");
    setAiError(null);
    setAiSources([]);
    if (enabled) void ensureRagSession();
  }

  async function ensureRagSession(): Promise<void> {
    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch("/api/rag/session", { method: "POST" });
      await readApiJson(response, "Failed to create RAG session");
    } catch (error: unknown) {
      setAiError(error instanceof Error ? error.message : "Failed to create RAG session");
    } finally {
      setAiLoading(false);
    }
  }

  const pollDocumentStatus = useCallback(async (): Promise<void> => {
    const response = await fetch("/api/rag/documents");
    const payload = await readApiJson(response, "Failed to load document status");
    const statuses = collectDocumentStatuses(payload);
    setAiDocumentStatus(summarizeDocumentStatus(statuses));
  }, []);

  async function handleUploadDocument(files: File[]): Promise<void> {
    setAiLoading(true);
    setAiError(null);
    setAiDocumentStatus("uploading");

    try {
      const form = new FormData();
      for (const file of files) form.append("files", file, file.name);
      const response = await fetch("/api/rag/upload", {
        method: "POST",
        body: form,
      });
      await readApiJson(response, "Failed to upload document");
      await pollDocumentStatus();
    } catch (error: unknown) {
      setAiDocumentStatus("failed");
      setAiError(error instanceof Error ? error.message : "Failed to upload document");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAskAi(): Promise<void> {
    const question = q.trim();
    if (!question || aiLoading || isRagAttachmentInFlight(aiDocumentStatus)) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch("/api/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = await readApiJson(response, "Failed to ask RAG session");
      setAiAnswer(readAnswer(payload));
      setAiSources(readSources(payload));
    } catch (error: unknown) {
      setAiError(error instanceof Error ? error.message : "Failed to ask RAG session");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (!aiEnabled || aiDocumentStatus === "idle" || aiDocumentStatus === "indexed" || aiDocumentStatus === "failed") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollDocumentStatus().catch((error: unknown) => {
        setAiDocumentStatus("failed");
        setAiError(error instanceof Error ? error.message : "Failed to load document status");
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [aiDocumentStatus, aiEnabled, pollDocumentStatus]);

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
          loading={countryLoading}
          rows={countryRowsWithColors}
          theme={theme}
          totalOverride={totalPapers}
          onCountryClick={handleCountryClick}
        />
      </div>

      <h1 className="mb-3 text-[26px] font-semibold">{headingText}</h1>

      <SearchControls
        aiAnswer={aiAnswer}
        aiDocumentStatus={aiDocumentStatus === "idle" ? "" : aiDocumentStatus}
        aiEnabled={aiEnabled}
        aiError={aiError}
        aiLoading={aiLoading}
        aiSources={aiSources}
        canSearch={canSearch}
        err={err}
        hasItems={items.length > 0}
        loading={loading}
        onApplyPrefix={applySearchPrefix}
        onAskAi={handleAskAi}
        onQueryChange={handleQueryChange}
        onToggleAi={handleToggleAi}
        onUploadDocument={handleUploadDocument}
        onYearRangeChange={setYearRange}
        prefixButtonClass={prefixButtonClass}
        query={q}
        searchInputClass={searchInputClass}
        searchInputRef={searchInputRef}
        yearRange={yearRange}
      />

      {!aiEnabled && describeIri ? (
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

      {!aiEnabled ? (
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
      ) : null}

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
