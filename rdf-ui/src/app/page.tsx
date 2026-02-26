"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import type { PaperDetails, SearchItem, SearchResponse, Row } from "@/lib/types";
import UsersByCountryWidget from "@/components/CountryWidget";

const PAGE_SIZE = 25;

function ccToFlag(cc: string): string {
  const code = (cc || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const A = 0x1f1e6;
  const first = A + (code.charCodeAt(0) - 65);
  const second = A + (code.charCodeAt(1) - 65)
  return String.fromCodePoint(first, second)
}

function useDebounce<T>(value: T, delayMs = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

function cctoName(cc: string, locale: string = "en"): string {
  const code = (cc || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

function normalizeCountryLookup(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COUNTRY_ALIASES: Record<string, string> = {
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  uk: "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  uae: "AE",
  "south korea": "KR",
  "north korea": "KP",
  russia: "RU",
  "czech republic": "CZ",
  "ivory coast": "CI",
};

const COUNTRY_NAME_TO_CODE: Map<string, string> = (() => {
  const out = new Map<string, string>();
  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return out;
  }

  for (let i = 65; i <= 90; i += 1) {
    for (let j = 65; j <= 90; j += 1) {
      const code = `${String.fromCharCode(i)}${String.fromCharCode(j)}`;
      const name = displayNames.of(code);
      if (!name || name.toUpperCase() === code) continue;
      out.set(normalizeCountryLookup(name), code);
    }
  }

  return out;
})();

function toCountryCode(input: string): string {
  const value = (input || "").trim();
  if (!value) return "";

  const directCode = value.toUpperCase().match(/\b[A-Z]{2}\b/);
  if (directCode?.[0]) return directCode[0];

  const compact = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (/^[A-Z]{2}$/.test(compact)) return compact;

  const normalized = normalizeCountryLookup(value);
  if (!normalized) return "";

  const aliased = COUNTRY_ALIASES[normalized];
  if (aliased) return aliased;

  return COUNTRY_NAME_TO_CODE.get(normalized) ?? "";
}

function ccToColor(rank: number): string {
  const alpha = Math.max(0.2, 1 - rank * 0.2);
  return `rgba(255,255,255,${alpha})`
}

function extractDirectAuthorIri(input: string): string | null {
  const m = input.match(/^\s*(?:a|author)\s*:\s*(<)?(https?:\/\/\S+?)\1?\s*$/i);
  if (!m?.[2]) return null;
  return m[2].trim().replace(/[)>.,;]+$/, "");
}

function toPossessive(name: string): string {
  const n = name.trim();
  if (!n) return "Author's";
  if (/[sS]$/.test(n)) return `${n}'`;
  return `${n}'s`;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function toFriendlyHttpError(r: Response, fallback: string): Promise<string> {
  if (r.status === 504) {
    return "The search timed out on the server. Please narrow your query and try again.";
  }

  if (r.status === 502 || r.status === 503) {
    return "The search service is temporarily unavailable. Please try again in a moment.";
  }

  const ct = r.headers.get("content-type") ?? "";

  try {
    if (ct.includes("application/json")) {
      const j = await r.json();
      const msg = typeof j?.error === "string" ? j.error : "";
      if (msg) return msg;
    } else {
      const text = await r.text();
      const clean = stripHtml(text);
      if (clean) return clean.slice(0, 220);
    }
  } catch {
    // Ignore body parsing failures and use fallback below.
  }

  return `${fallback} (HTTP ${r.status})`;
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 400);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [searchTotal, setSearchTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState<Record<string, PaperDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [detailsErr, setDetailsErr] = useState<Record<string, string>>({});

  const [CountryRows, setCountryRows] = useState<Row[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryErr, setCountryErr] = useState<string | null>(null);

  const [totalPapers, setTotalPapers] = useState<number>(0);
  const [knownAuthorNames, setKnownAuthorNames] = useState<Record<string, string>>({});

  const canSearch = useMemo(() => dq.trim().length >= 3, [dq]);
  const activeAuthorIri = useMemo(() => extractDirectAuthorIri(q), [q]);
  const activeAuthorName = useMemo(
    () => (activeAuthorIri ? knownAuthorNames[activeAuthorIri] ?? "" : ""),
    [activeAuthorIri, knownAuthorNames]
  );
  const headingText = activeAuthorIri && activeAuthorName
    ? `${toPossessive(activeAuthorName)} Papers | Total: ${searchTotal}`
    : "Papers";

  function applySearchPrefix(prefix: "a:" | "y:" | "aff:" | "c:") {
    const current = q.trimEnd();
    const separator = current.length > 0 ? " " : "";
    const next = `${current}${separator}${prefix} `;
    const cursorPos = next.length;
    setQ(next);

    requestAnimationFrame(() => {
      const el = searchInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  const fetchSearchPage = useCallback(async (offset: number): Promise<SearchResponse> => {
    const r = await fetch(
      `/api/search?q=${encodeURIComponent(dq.trim())}&offset=${offset}&limit=${PAGE_SIZE}`
    );
    if (!r.ok) throw new Error(await toFriendlyHttpError(r, "Search failed"));

    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      throw new Error("Search failed: unexpected response format.");
    }

    return (await r.json()) as SearchResponse;
  }, [dq]);

  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      setCountryLoading(true);
      setCountryErr(null);
      try {
        const r = await fetch(`/api/top-countries`);
        const ct = r.headers.get("content-type") ?? "";

        let j: any = null;
        if (ct.includes("application/json")) j = await r.json() 
        else throw new Error((await r.text()) || `HTTP ${r.status}`);

        if (!r.ok) throw new Error(j?.error ?? "Failed to load countries");
        const mapped: Row[] = (j.rows.rows ?? []).map((x: any) => {
          const cc = String(x.name ?? "").trim().toUpperCase();
          const papers = Number(x.value) || 0;

          const countryName = cctoName(cc, "en");
          const flag = ccToFlag(cc);
          const labelWithCode = countryName && countryName !== cc
            ? `${countryName} (${cc})`
            : cc;
          const label = flag ? `${flag} ${labelWithCode}` : labelWithCode;

          return { name: label, value: papers, code: cc };
        });

        const packed = mapped.map((r, idx) => ({
          ...r,
          color: ccToColor(idx),
        }));

        if (!cancelled) {
          setCountryRows(packed);
          setTotalPapers(Number(j.rows.totalPapers) || 0);
        };
      } catch (e: any) {
        if (!cancelled) setCountryErr(e?.message ?? "Error");
      } finally {
        if (!cancelled) setCountryLoading(false);
      }
    }

    loadCountries();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setOpenIds(new Set());
      setDetails({});
      setDetailsErr({});
      setDetailsLoading({});

      if (!canSearch) {
        setItems([]);
        setSearchTotal(0);
        setNextOffset(0);
        setHasMore(false);
        setErr(null);
        return;
      }
      setLoading(true);
      setLoadingMore(false);
      setErr(null);
      try {
        const j = await fetchSearchPage(0);
        if (!cancelled) {
          const nextItems = j.items ?? [];
          const total = Number(j.total) || nextItems.length;
          setItems(nextItems);
          setSearchTotal(total);
          setNextOffset(nextItems.length);
          setHasMore(nextItems.length < total);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Error");
          setItems([]);
          setSearchTotal(0);
          setNextOffset(0);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [canSearch, fetchSearchPage]);

  const loadMore = useCallback(async () => {
    if (!canSearch || loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const j = await fetchSearchPage(nextOffset);
      const incoming = j.items ?? [];
      const total = Number(j.total) || searchTotal;

      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.iri));
        const merged = [...prev];
        for (const it of incoming) {
          if (!seen.has(it.iri)) {
            merged.push(it);
            seen.add(it.iri);
          }
        }
        return merged;
      });

      const loadedCount = nextOffset + incoming.length;
      setSearchTotal(total);
      setNextOffset(loadedCount);
      setHasMore(incoming.length > 0 && loadedCount < total);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [canSearch, loading, loadingMore, hasMore, fetchSearchPage, nextOffset, searchTotal]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !canSearch) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "220px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [canSearch, loadMore]);

  async function ensureDetails(id: string) {
    if (details[id] || detailsLoading[id]) return;

    setDetailsLoading((m) => ({ ...m, [id]: true }));
    setDetailsErr((m) => ({ ...m, [id]: ""}));

    try {
      const r = await fetch(`/api/paper?id=${encodeURIComponent(id)}`);
      const ct = r.headers.get("content-type") ?? "";

      let j: any = null
      if (ct.includes("application/json")) {
        j = await r.json()
      } else {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }

      if (!r.ok) throw new Error((j as any)?.error ?? "Failed to load paper");
      setDetails((m) => ({ ...m, [id]: j }));

      const authors = Array.isArray(j?.authorsDetailed) ? j.authorsDetailed : [];
      if (authors.length > 0) {
        setKnownAuthorNames((m) => {
          const next = { ...m };
          for (const a of authors) {
            const iri = typeof a?.iri === "string" ? a.iri : "";
            const name = typeof a?.name === "string" ? a.name : "";
            if (iri && name) next[iri] = name;
          }
          return next;
        });
      }
    } catch (e: any) {
      setDetailsErr((m) => ({ ...m, [id]: e?.message ?? "Error"}));
    } finally {
      setDetailsLoading((m) => ({ ...m, [id]: false }));
    }
  }

  return (
    <main className="mx-auto max-w-[900px] p-6 font-sans">
      <a
        href="http://upbkg.data.dice-research.org/sparql"
        target="_blank"
        rel="noreferrer"
        className="mb-4 inline-block"
      >
        <Image
          src="/sparql-96.png"
          alt="SPARQL endpoint"
          width={48}
          height={48}
          priority
        />
      </a>

      <div className="mb-6">
        {countryErr ? (
          <div className="mb-3 text-sm text-red-600">{countryErr}</div>
        ) : null}

        <UsersByCountryWidget
          rows={CountryRows}
          totalOverride={totalPapers}
          onCountryClick={(countryCode) => {
            const code = (countryCode || "").trim().toUpperCase();
            if (!code) return;
            const next = `c: ${code}`;
            setQ(next);
            requestAnimationFrame(() => {
              const el = searchInputRef.current;
              if (!el) return;
              el.focus();
              el.setSelectionRange(next.length, next.length);
            });
          }}
        />

        {countryLoading ? (
          <div className="mt-2 text-xs text-gray-400">Loading countries...</div>
        ) : null}
      </div>

      <h1 className="mb-3 text-[26px] font-semibold">{headingText}</h1>

      <input 
        ref={searchInputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search paper title... (a:, y:, aff:, c:)"
        className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base outline-none focus:border-gray-400"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded-xl border border-gray-300 bg-transparent px-3 py-1.5 text-sm transition-colors hover:bg-gray-900"
          onClick={() => applySearchPrefix("a:")}
        >
          author
        </button>
        <button
          type="button"
          className="rounded-xl border border-gray-300 bg-transparent px-3 py-1.5 text-sm transition-colors hover:bg-gray-900"
          onClick={() => applySearchPrefix("y:")}
        >
          year
        </button>
        <button
          type="button"
          className="rounded-xl border border-gray-300 bg-transparent px-3 py-1.5 text-sm transition-colors hover:bg-gray-900"
          onClick={() => applySearchPrefix("aff:")}
        >
          affiliation
        </button>
        <button
          type="button"
          className="rounded-xl border border-gray-300 bg-transparent px-3 py-1.5 text-sm transition-colors hover:bg-gray-900"
          onClick={() => applySearchPrefix("c:")}
        >
          country
        </button>
      </div>

      <div className="mt-3 min-h-6">
        {loading && <span>Searching...</span>}
        {err && <span className="text-red-600">{err}</span>}
        {!loading && !err && canSearch && items.length === 0 && <span>No results.</span>}
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((it) => {
          const isOpen = openIds.has(it.id);
          const d = details[it.id];
          const keywords = d?.keywords ?? [];
          const fields = d?.fields ?? [];
          const subfields = d?.subfields ?? [];
          const loadingD = !!detailsLoading[it.id];
          const errD = detailsErr[it.id];
          const whereParts: string[] = [];
          if (d?.volume) whereParts.push(`Vol. ${d.volume}`);
          if (d?.issue) whereParts.push(`Issue ${d.issue}`);

          const pages = 
            d?.pageStart && d?.pageEnd ? `pp. ${d.pageStart}-${d.pageEnd}`
            : d?.pageStart ? `p. ${d.pageStart}`
            : d?.pageEnd ? `p. ${d.pageEnd}`
            : null;

          if (pages) whereParts.push(pages);

          return (
          <li 
            key={it.iri} 
            className={`rounded-xl border p-4 transition ${
              isOpen ? "border-gray-400" : "border-gray-200"
            }`}
          >
            <button
              type="button"
              className="text-left w-full"
              onClick={() => {
                const willOpen = !openIds.has(it.id);

                setOpenIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(it.id)) next.delete(it.id);
                  else next.add(it.id);                  
                  return next;
                });

                if (willOpen) ensureDetails(it.id);
              }}
            >
              <div className="text-[17px] font-semibold">
                {it.title || it.id}
              </div>
              <div className="mt-1.5 text-sm text-gray-300">
                <span>{it.year ?? "—"}</span>
                <span className="mx-2">·</span>
                <span>{it.authorsText || "Authors: —"}</span>
              </div>
            </button>
            
            {isOpen && (
              <div className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-300">
                {loadingD && <div>Loading details...</div>}
                {errD && <div className="text-red-600">{errD}</div>}

                {d && !loadingD && !errD && (
                  <div className="space-y-2">
                    {d.subtitle && (
                      <div>
                        <span className="font-medium">Subtitle:</span> {d.subtitle}
                      </div>
                    )}

                    {d.isPartOfNames?.[0] && (
                      <div>
                        <span className="font-medium">Journal:</span> {d.isPartOfNames[0]}
                      </div>
                    )}

                    {whereParts.length > 0 && (
                      <div>
                        <span className="font-medium">Where:</span> {whereParts.join(", ")}
                      </div>
                    )}

                    {keywords.length > 0 && (
                      <div>
                        <span className="font-medium">Keywords:</span>{" "}
                        {keywords.slice(0, 12).join(", ")}
                      </div>
                    )}
                    {fields.length > 0 && (
                      <div>
                        <span className="font-medium">Fields:</span>{" "}
                        {fields.slice(0, 12).join(", ")}
                      </div>
                    )}
                    {subfields.length > 0 && (
                      <div>
                        <span className="font-medium">Subfields:</span>{" "}
                        {subfields.slice(0, 12).join(", ")}
                      </div>
                    )}

                    {d.abstract && (
                      <div className="text-gray-400">
                        <span className="font-medium">Abstract:</span>{" "}
                        <span className="block mt-1 text-gray-200 line-clamp-4">
                          {d.abstract}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-1">
                      {d.sameAs && (
                        <a className="underline" href={d.sameAs} target="_blank" rel="noreferrer">
                          DOI / sameAs
                        </a>
                      )}
                      {d.urls?.[0] && (
                        <a className="underline" href={d.urls[0]} target="_blank" rel="noreferrer">
                          URL
                        </a>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Authors:</span>
                      <ul className="mt-1 space-y-1">
                        {d.authorsDetailed?.map((a) => (
                          <li key={a.iri}>
                            <div className="text-gray-200">                              
                              <button
                                type="button"
                                className="hover:underline"
                                onClick={() => {
                                  setKnownAuthorNames((m) => ({ ...m, [a.iri]: a.name }));
                                  setQ(`a: ${a.iri}`);
                                }}
                              >
                                {a.name}
                              </button>
                              {a.orcid ? (
                                <a
                                  href={a.orcid}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 inline-flex align-middle"
                                  aria-label={`${a.name} ORCID`}
                                  title="ORCID"
                                >
                                  <Image
                                    src="/orcid2.png"
                                    alt="ORCID"
                                    width={14}
                                    height={14}
                                  />
                                </a>
                              ) : null}
                            </div>
                            {a.affiliations.length > 0 && (
                              <div className="text-xs text-gray-400">
                                {a.affiliations.map((aff, i) => {
                                  const ccRaw = (aff.countryRaw ?? "").trim();
                                  const ccCode = toCountryCode(ccRaw);
                                  const flag = ccCode ? ccToFlag(ccCode) : "";
                                  const countryTitle = ccCode
                                    ? `${cctoName(ccCode, "en")} (${ccCode})`
                                    : ccRaw;
                                  const affHref = (aff.sameAs ?? "").toLowerCase().includes("ror.org")
                                    ? aff.sameAs
                                    : undefined;
                                  return (
                                    <span key={`${a.iri}-aff-${i}`}>
                                      <span title={aff.name}>
                                        {affHref ? (
                                          <a
                                            href={affHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            {aff.name}
                                          </a>
                                        ) : (
                                          <span>{aff.name}</span>
                                        )}
                                      </span>
                                      {countryTitle ? (
                                        <span className="ml-1" title={countryTitle}>
                                          {flag || countryTitle}
                                        </span>
                                      ) : null}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
          );
        })}
      </ul>
      {canSearch && items.length > 0 ? (
        <div ref={loadMoreRef} className="mt-3 min-h-6 text-sm text-gray-400">
          {loadingMore ? "Loading more..." : hasMore ? "Scroll to load more" : "End of results."}
        </div>
      ) : null}

      <div className="mt-18 flex items-center justify-center">
        <Link 
          href="https://dice-research.org/" 
          aria-label="Dice research group" 
          rel="noreferrer" 
          target="_blank"
        >
          <Image
            src="logo.svg" 
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
