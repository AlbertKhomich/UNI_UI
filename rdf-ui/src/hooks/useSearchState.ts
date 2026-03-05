"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bodyErrorMessage, toErrorMessage } from "@/lib/errors";
import { assignAuthorNameByIriVariants } from "@/lib/query";
import type { PaperDetails, SearchItem, SearchResponse } from "@/lib/types";

const PAGE_SIZE = 25;

type UseSearchStateArgs = {
  debouncedQuery: string;
  debouncedAuthorIri: string | null;
};

function dedupeByIri(items: SearchItem[]): SearchItem[] {
  const seen = new Set<string>();
  const out: SearchItem[] = [];
  for (const item of items) {
    if (!item?.iri || seen.has(item.iri)) continue;
    seen.add(item.iri);
    out.push(item);
  }
  return out;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function toFriendlyHttpError(response: Response, fallback: string): Promise<string> {
  if (response.status === 504) {
    return "The search timed out on the server. Please narrow your query and try again.";
  }

  if (response.status === 502 || response.status === 503) {
    return "The search service is temporarily unavailable. Please try again in a moment.";
  }

  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const json = await response.json();
      const message = typeof json?.error === "string" ? json.error : "";
      if (message) return message;
    } else {
      const text = await response.text();
      const clean = stripHtml(text);
      if (clean) return clean.slice(0, 220);
    }
  } catch {
    // Ignore body parsing failures and use fallback below.
  }

  return `${fallback} (HTTP ${response.status})`;
}

export function useSearchState({ debouncedQuery, debouncedAuthorIri }: UseSearchStateArgs) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [items, setItems] = useState<SearchItem[]>([]);
  const [searchTotal, setSearchTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState<Record<string, PaperDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [detailsErr, setDetailsErr] = useState<Record<string, string>>({});

  const [knownAuthorNames, setKnownAuthorNames] = useState<Record<string, string>>({});

  const canSearch = useMemo(() => debouncedQuery.trim().length >= 3, [debouncedQuery]);

  const fetchSearchPage = useCallback(
    async (cursor: string | null): Promise<SearchResponse> => {
      const params = new URLSearchParams({
        q: debouncedQuery.trim(),
        limit: String(PAGE_SIZE),
      });
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error(await toFriendlyHttpError(response, "Search failed"));

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Search failed: unexpected response format.");
      }

      return (await response.json()) as SearchResponse;
    },
    [debouncedQuery],
  );

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      setOpenIds(new Set());
      setDetails({});
      setDetailsErr({});
      setDetailsLoading({});

      if (!canSearch) {
        setItems([]);
        setSearchTotal(0);
        setNextCursor(null);
        setHasMore(false);
        setErr(null);
        return;
      }

      setLoading(true);
      setLoadingMore(false);
      setErr(null);

      try {
        const payload = await fetchSearchPage(null);
        if (cancelled) return;

        const nextItems = dedupeByIri(payload.items ?? []);
        const total = Number(payload.total) || nextItems.length;
        const next = typeof payload.nextCursor === "string" && payload.nextCursor ? payload.nextCursor : null;
        setItems(nextItems);
        setSearchTotal(total);
        setNextCursor(next);
        setHasMore(Boolean(next));

        if (debouncedAuthorIri && typeof payload.authorName === "string" && payload.authorName.trim()) {
          const directAuthorName = payload.authorName.trim();
          setKnownAuthorNames((current) => {
            const nextKnown = { ...current };
            assignAuthorNameByIriVariants(nextKnown, debouncedAuthorIri, directAuthorName);
            if (typeof payload.authorIri === "string" && payload.authorIri.trim()) {
              assignAuthorNameByIriVariants(nextKnown, payload.authorIri, directAuthorName);
            }
            return nextKnown;
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErr(toErrorMessage(error));
          setItems([]);
          setSearchTotal(0);
          setNextCursor(null);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [canSearch, debouncedAuthorIri, fetchSearchPage]);

  const loadMore = useCallback(async () => {
    if (!canSearch || loading || loadingMore || !hasMore) return;
    if (!nextCursor) return;

    setLoadingMore(true);
    try {
      const payload = await fetchSearchPage(nextCursor);
      const incoming = payload.items ?? [];
      const total = Number(payload.total) || searchTotal;
      const next = typeof payload.nextCursor === "string" && payload.nextCursor ? payload.nextCursor : null;

      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.iri));
        const merged = [...prev];
        for (const item of incoming) {
          if (!seen.has(item.iri)) {
            merged.push(item);
            seen.add(item.iri);
          }
        }
        return merged;
      });

      setSearchTotal(total);
      setNextCursor(next);
      setHasMore(Boolean(next));
    } catch (error: unknown) {
      setErr(toErrorMessage(error));
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [canSearch, fetchSearchPage, hasMore, loading, loadingMore, nextCursor, searchTotal]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !canSearch) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "220px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [canSearch, loadMore]);

  const ensureDetails = useCallback(
    async (id: string) => {
      if (details[id] || detailsLoading[id]) return;

      setDetailsLoading((current) => ({ ...current, [id]: true }));
      setDetailsErr((current) => ({ ...current, [id]: "" }));

      try {
        const response = await fetch(`/api/paper?id=${encodeURIComponent(id)}`);
        const contentType = response.headers.get("content-type") ?? "";

        let payload: unknown = null;
        if (contentType.includes("application/json")) {
          payload = await response.json();
        } else {
          const text = await response.text();
          throw new Error(text || `HTTP ${response.status}`);
        }

        if (!response.ok) throw new Error(bodyErrorMessage(payload) ?? "Failed to load paper");
        if (!payload || typeof payload !== "object") throw new Error("Failed to load paper");

        const detailsPayload = payload as PaperDetails;
        setDetails((current) => ({ ...current, [id]: detailsPayload }));

        const authors = Array.isArray(detailsPayload.authorsDetailed) ? detailsPayload.authorsDetailed : [];
        if (authors.length > 0) {
          setKnownAuthorNames((current) => {
            const next = { ...current };
            for (const author of authors) {
              const iri = typeof author.iri === "string" ? author.iri : "";
              const name = typeof author.name === "string" ? author.name : "";
              if (iri && name) assignAuthorNameByIriVariants(next, iri, name);
            }
            return next;
          });
        }
      } catch (error: unknown) {
        setDetailsErr((current) => ({ ...current, [id]: toErrorMessage(error) }));
      } finally {
        setDetailsLoading((current) => ({ ...current, [id]: false }));
      }
    },
    [details, detailsLoading],
  );

  const togglePaperOpen = useCallback(
    (id: string) => {
      const willOpen = !openIds.has(id);

      setOpenIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

      if (willOpen) void ensureDetails(id);
    },
    [ensureDetails, openIds],
  );

  const rememberAuthorName = useCallback((iri: string, name: string) => {
    setKnownAuthorNames((current) => {
      const next = { ...current };
      assignAuthorNameByIriVariants(next, iri, name);
      return next;
    });
  }, []);

  return {
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
  };
}
