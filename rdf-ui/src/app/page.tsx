"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DescribeResultPanel from "@/components/DescribeResultPanel";
import DiceFooter from "@/components/DiceFooter";
import PageContainer from "@/components/PageContainer";
import PaperResultsList from "@/components/PaperResultsList";
import SearchControls from "@/components/SearchControls";
import SiteHeader from "@/components/SiteHeader";
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
type RagStreamEvent = {
  type?: unknown;
  text?: unknown;
  error?: unknown;
  citations?: unknown;
  sources?: unknown;
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

function readOptionalString(value: unknown, keys: string[]): string | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    const next = value[key];
    if (typeof next === "string" && next.trim()) return next.trim();
  }
  return undefined;
}

function readOptionalNumber(value: unknown, keys: string[]): number | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    const next = value[key];
    if (typeof next === "number") return next;
  }
  return undefined;
}

function readDocumentSource(source: unknown): RagSource[] {
  if (!isRecord(source)) return [];

  const chunkId = readOptionalString(source, ["chunk_id", "chunkId", "id"]);
  const documentId = readOptionalString(source, ["document_id", "documentId", "document"]);
  if (!chunkId || !documentId) return [];

  return [{
    chunk_id: chunkId,
    document_id: documentId,
    filename: readOptionalString(source, ["filename", "file_name", "fileName"]),
    page: readOptionalNumber(source, ["page", "page_number", "pageNumber"]),
  }];
}

function readSources(payload: unknown): RagSource[] {
  if (!isRecord(payload)) return [];

  const citations = isRecord(payload.citations) ? payload.citations : null;
  const documentSources = [
    ...(Array.isArray(payload.sources) ? payload.sources.flatMap(readDocumentSource) : []),
    ...(citations && Array.isArray(citations.chunks) ? citations.chunks.flatMap(readDocumentSource) : []),
  ];
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

async function readRagStream(response: Response, onEvent: (event: RagStreamEvent) => void): Promise<void> {
  if (!response.ok) {
    await readApiJson(response, "Failed to ask RAG session");
    return;
  }

  if (!response.body) throw new Error("RAG stream response did not include a body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handleEvent = (event: RagStreamEvent): boolean => {
    onEvent(event);
    if (event.type === "error") {
      throw new Error(typeof event.error === "string" ? event.error : "Failed to ask RAG session");
    }
    return event.type === "done";
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as RagStreamEvent;
      if (handleEvent(event)) {
        await reader.cancel().catch(() => undefined);
        return;
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as RagStreamEvent;
    handleEvent(event);
  }
}
async function copyShareUrl(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for browsers that expose the API but deny it outside a secure context.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
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
    setAiAnswer("");
    setAiSources([]);

    try {
      const response = await fetch("/api/rag/ask-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      await readRagStream(response, (event) => {
        if (event.type === "token" && typeof event.text === "string") {
          setAiAnswer((answer) => `${answer}${event.text}`);
        }
        if (event.type === "done") {
          setAiSources(readSources(event));
        }
      });
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

  async function handleSharePaper(title: string): Promise<void> {
    const url = new URL("/share", window.location.origin);
    url.searchParams.set("q", title);
    await copyShareUrl(url.toString());
  }

  async function handleCopyAiAnswer(): Promise<void> {
    await copyShareUrl(aiAnswer);
  }

  return (
    <PageContainer>
      <SiteHeader
        className="mb-4"
        isDark={isDark}
        onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
      />

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
        onCopyAiAnswer={handleCopyAiAnswer}
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
        onSharePaper={handleSharePaper}
        onTogglePaperOpen={togglePaperOpen}
        openIds={openIds}
        subtleTextClass={subtleTextClass}
      />

      <DiceFooter className="mt-18" />
    </PageContainer>
  );
}
