"use client";

import { useEffect, useMemo, useState } from "react"
import type { PaperDetails, SearchItem } from "@/lib/types";

function useDebounce<T>(value: T, delayMs = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export default function HomePage(){
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 400);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState<Record<string, PaperDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [detailsErr, setDetailsErr] = useState<Record<string, string>>({});

  const canSearch = useMemo(() => dq.trim().length >= 3, [dq]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setOpenIds(new Set());
      setDetails({});
      setDetailsErr({});
      setDetailsLoading({});

      if (!canSearch) {
        setItems([]);
        setErr(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(dq.trim())}`);
        const ct = r.headers.get("content-type") ?? "";

        let j: any = null;
        if (ct.includes("application/json")) {
          j = await r.json();
        } else {
          const text = await r.text();
          throw new Error(text || `HTTP ${r.status}`);
        }

        if (!r.ok) throw new Error(j?.error ?? "Search failed");
        if (!cancelled) setItems(j.items ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [dq, canSearch]);

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
    } catch (e: any) {
      setDetailsErr((m) => ({ ...m, [id]: e?.message ?? "Error"}));
    } finally {
      setDetailsLoading((m) => ({ ...m, [id]: false }));
    }
  }

  return (
    <main className="mx-auto max-w-[900px] p-6 font-sans">
      <h1 className="mb-3 text-[26px] font-semibold">Papers</h1>

      <input 
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search paper title..."
        className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base outline-none focus:border-gray-400"
      />

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

                    {d.abstract && (
                      <div className="text-gray-400">
                        <span className="font-medium">Abstract:</span>{" "}
                        <span className="block mt-1 text-gray-200 line-clamp-4">
                          {d.abstract}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-1">
                      {d.sameAs?.[0] && (
                        <a className="underline" href={d.sameAs[0]} target="_blank" rel="noreferrer">
                          DOI / sameAs
                        </a>
                      )}
                      {d.urls?.[0] && (
                        <a className="underline" href={d.urls[0]} target="_blank" rel="noreferrer">
                          URL
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
          );
        })}
      </ul>
    </main>
  );

}