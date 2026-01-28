"use client";

import { useEffect, useMemo, useState } from "react"
import Link from "next/link";

type Item = {
  id: string;
  iri: string;
  title: string;
  year?: string;
  authorsText: string;
};

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
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSearch = useMemo(() => dq.trim().length >= 3, [dq]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canSearch) {
        setItems([]);
        setErr(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/search?title=${encodeURIComponent(dq.trim())}`);
        let j: any = null;
        const ct = r.headers.get("content-type") ?? "";
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
        {items.map((it) => (
          <li key={it.iri} className="rounded-xl border border-gray-200 p-4">
            <Link href={`/paper/${encodeURIComponent(it.id)}`} className="text-[17px] font-semibold">
              {it.title || it.id}
            </Link>
            <div className="mt-1.5 text-sm text-gray-600">
              <span>{it.year ?? "—"}</span>
              <span className="mx-2">·</span>
              <span>{it.authorsText || "Authors: -"}</span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );

}