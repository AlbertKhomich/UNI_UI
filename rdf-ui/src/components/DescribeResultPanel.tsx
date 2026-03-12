"use client";

import { useMemo, type ReactNode } from "react";
import DescribeLocationMap from "@/components/DescribeLocationMap";
import { extractDescribeLocationPoints } from "@/lib/describeLocations";
import type { DescribeQuad, DescribeTerm } from "@/lib/types";

type DescribeResultPanelProps = {
  body: string;
  contentType: string;
  error: string | null;
  iri: string;
  isDark: boolean;
  loading: boolean;
  parseError: string | null;
  prefixes: Record<string, string>;
  quads: DescribeQuad[];
};

type PrefixMap = Record<string, string>;
type PrefixEntry = { prefix: string; iriBase: string };

type Segment =
  | { kind: "text"; text: string }
  | { kind: "uri"; text: string; href: string }
  | { kind: "prefixed"; text: string; href: string }
  | { kind: "literal"; text: string }
  | { kind: "keyword"; text: string };

const TOKEN_REGEX =
  /<[^>\s]+>|https?:\/\/[^\s<>"']+|"(?:[^"\\]|\\.)*"(?:@[A-Za-z0-9-]+|\^\^<[^>]+>)?|@[A-Za-z]+|\b(?:PREFIX|BASE|DESCRIBE|SELECT|CONSTRUCT|ASK)\b|(?:[A-Za-z][\w-]*|):[^\s;,.()\[\]{}]+/g;
const KEYWORDS = new Set(["@prefix", "@base", "prefix", "base", "describe", "select", "construct", "ask"]);
const BUILTIN_PREFIXES: PrefixMap = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  schema: "https://schema.org/",
};
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";

function formatCoordinate(value: number): string {
  return value.toFixed(5).replace(/\.?0+$/, "");
}

function openStreetMapHref(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`;
}

function normalizeHttpHref(input: string): string | null {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parsePrefixes(input: string): PrefixMap {
  const out: PrefixMap = {};
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const ttlMatch = line.match(/^\s*@prefix\s+([A-Za-z][\w-]*|)\s*:\s*<([^>]+)>/i);
    if (ttlMatch) {
      const key = (ttlMatch[1] ?? "").trim();
      const href = normalizeHttpHref((ttlMatch[2] ?? "").trim());
      if (href) out[key] = href;
      continue;
    }

    const sparqlMatch = line.match(/^\s*prefix\s+([A-Za-z][\w-]*|)\s*:\s*<([^>]+)>/i);
    if (sparqlMatch) {
      const key = (sparqlMatch[1] ?? "").trim();
      const href = normalizeHttpHref((sparqlMatch[2] ?? "").trim());
      if (href) out[key] = href;
    }
  }

  return out;
}

function toSortedPrefixEntries(prefixes: PrefixMap): PrefixEntry[] {
  return Object.entries(prefixes)
    .filter(([, iriBase]) => !!normalizeHttpHref(iriBase))
    .map(([prefix, iriBase]) => ({ prefix, iriBase }))
    .sort((a, b) => b.iriBase.length - a.iriBase.length);
}

function compactIri(iri: string, entries: PrefixEntry[]): string {
  for (const entry of entries) {
    if (!iri.startsWith(entry.iriBase)) continue;
    const local = iri.slice(entry.iriBase.length);
    if (!local) continue;
    return entry.prefix ? `${entry.prefix}:${local}` : `:${local}`;
  }
  return iri;
}

function renderNamedNode(iri: string, entries: PrefixEntry[], isDark: boolean): ReactNode {
  const href = normalizeHttpHref(iri);
  const label = compactIri(iri, entries);

  if (!href) return <span className="break-all">{label}</span>;
  return (
    <a
      className={isDark ? "break-all text-cyan-300 underline" : "break-all text-cyan-700 underline"}
      href={href}
    >
      {label}
    </a>
  );
}

function renderTerm(term: DescribeTerm, entries: PrefixEntry[], isDark: boolean): ReactNode {
  if (term.termType === "NamedNode") return renderNamedNode(term.value, entries, isDark);
  if (term.termType === "BlankNode") return <span className={isDark ? "text-gray-300" : "text-gray-700"}>_:{term.value}</span>;
  if (term.termType === "DefaultGraph") return <span className={isDark ? "text-gray-400" : "text-gray-500"}>default</span>;

  const hasDatatype = !!term.datatype && term.datatype !== XSD_STRING;
  const hasLanguage = !!term.language;
  return (
    <span className="break-words">
      <span className={isDark ? "text-amber-300" : "text-amber-700"}>
        {'"'}
        {term.value}
        {'"'}
      </span>
      {hasLanguage ? <span className={isDark ? "text-gray-300" : "text-gray-700"}>@{term.language}</span> : null}
      {hasDatatype && term.datatype ? (
        <span className={isDark ? "text-gray-300" : "text-gray-700"}>
          ^^{renderNamedNode(term.datatype, entries, isDark)}
        </span>
      ) : null}
    </span>
  );
}

function splitLineComment(line: string): { code: string; comment: string } {
  let inString = false;
  let escaped = false;
  let inIri = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "<") {
      inIri = true;
      continue;
    }
    if (ch === ">") {
      inIri = false;
      continue;
    }
    if (ch === "#" && !inIri) {
      return {
        code: line.slice(0, i),
        comment: line.slice(i),
      };
    }
  }

  return { code: line, comment: "" };
}

function resolvePrefixedHref(token: string, prefixes: PrefixMap): string | null {
  const separatorIndex = token.indexOf(":");
  if (separatorIndex < 0) return null;
  const prefix = token.slice(0, separatorIndex);
  const localName = token.slice(separatorIndex + 1);
  if (!localName) return null;

  const base = prefixes[prefix];
  if (!base) return null;
  return normalizeHttpHref(`${base}${localName}`);
}

function tokenizeCode(code: string, prefixes: PrefixMap): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;

  for (const match of code.matchAll(TOKEN_REGEX)) {
    const token = match[0] ?? "";
    const start = match.index ?? 0;

    if (start > cursor) {
      out.push({ kind: "text", text: code.slice(cursor, start) });
    }

    if (token.startsWith("\"")) {
      out.push({ kind: "literal", text: token });
    } else if (token.startsWith("<") && token.endsWith(">")) {
      const href = normalizeHttpHref(token.slice(1, -1));
      if (href) out.push({ kind: "uri", text: token, href });
      else out.push({ kind: "text", text: token });
    } else if (token.startsWith("http://") || token.startsWith("https://")) {
      const href = normalizeHttpHref(token);
      if (href) out.push({ kind: "uri", text: token, href });
      else out.push({ kind: "text", text: token });
    } else if (KEYWORDS.has(token.toLowerCase())) {
      out.push({ kind: "keyword", text: token });
    } else {
      const href = resolvePrefixedHref(token, prefixes);
      if (href) out.push({ kind: "prefixed", text: token, href });
      else out.push({ kind: "text", text: token });
    }

    cursor = start + token.length;
  }

  if (cursor < code.length) {
    out.push({ kind: "text", text: code.slice(cursor) });
  }

  return out;
}

function renderSegments(segments: Segment[], isDark: boolean): ReactNode[] {
  return segments.map((segment, idx) => {
    if (segment.kind === "uri") {
      return (
        <a
          key={`segment-${idx}`}
          className={isDark ? "break-all text-cyan-300 underline" : "break-all text-cyan-700 underline"}
          href={segment.href}
        >
          {segment.text}
        </a>
      );
    }

    if (segment.kind === "prefixed") {
      return (
        <a
          key={`segment-${idx}`}
          className={isDark ? "break-all text-teal-300 underline" : "break-all text-teal-700 underline"}
          href={segment.href}
        >
          {segment.text}
        </a>
      );
    }

    if (segment.kind === "literal") {
      return (
        <span key={`segment-${idx}`} className={isDark ? "text-amber-300" : "text-amber-700"}>
          {segment.text}
        </span>
      );
    }

    if (segment.kind === "keyword") {
      return (
        <span key={`segment-${idx}`} className={isDark ? "text-violet-300" : "text-violet-700"}>
          {segment.text}
        </span>
      );
    }

    return <span key={`segment-${idx}`}>{segment.text}</span>;
  });
}

function renderRawRdf(body: string, prefixes: PrefixMap, isDark: boolean): ReactNode {
  const lines = body.split(/\r?\n/);
  const lineNoWidth = String(Math.max(1, lines.length)).length;
  return (
    <div
      className={`max-h-[420px] overflow-auto rounded-lg p-3 font-mono text-xs ${
        isDark ? "bg-black/40 text-gray-100" : "bg-white text-gray-800"
      }`}
    >
      {body ? (
        lines.map((line, lineIdx) => {
          const { code, comment } = splitLineComment(line);
          const segments = tokenizeCode(code, prefixes);
          return (
            <div key={`line-${lineIdx}`} className="flex gap-3 leading-6">
              <span
                className={`shrink-0 select-none text-right ${
                  isDark ? "text-gray-500" : "text-gray-400"
                }`}
                style={{ width: `${lineNoWidth + 1}ch` }}
                aria-hidden="true"
              >
                {lineIdx + 1}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                {renderSegments(segments, isDark)}
                {comment ? (
                  <span className={isDark ? "text-gray-500" : "text-gray-500"}>{comment}</span>
                ) : null}
              </span>
            </div>
          );
        })
      ) : (
        <div className={isDark ? "text-gray-400" : "text-gray-600"}>
          # No triples returned for this resource.
        </div>
      )}
    </div>
  );
}

export default function DescribeResultPanel(props: DescribeResultPanelProps) {
  const {
    body,
    contentType,
    error,
    iri,
    isDark,
    loading,
    parseError,
    prefixes,
    quads,
  } = props;
  const rawPrefixes = parsePrefixes(body);
  const effectivePrefixes = {
    ...BUILTIN_PREFIXES,
    ...rawPrefixes,
    ...(prefixes ?? {}),
  };
  const prefixEntries = toSortedPrefixEntries(effectivePrefixes);
  const hasNamedGraph = quads.some((quad) => !!quad.graph && quad.graph.termType !== "DefaultGraph");
  const locationPoints = useMemo(() => extractDescribeLocationPoints(quads, iri), [iri, quads]);

  return (
    <section
      className={`mt-4 rounded-xl border p-4 ${
        isDark ? "border-gray-600 bg-gray-900/40" : "border-gray-200 bg-gray-50"
      }`}
      aria-live="polite"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold">Resource Description (DESCRIBE)</h2>
        <a className="text-sm underline" href={iri}>
          {iri}
        </a>
      </div>

      {loading ? <div className="text-sm">Loading resource description...</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {!loading && !error ? (
        <>
          {contentType ? (
            <div className={isDark ? "mb-2 text-xs text-gray-400" : "mb-2 text-xs text-gray-600"}>
              Content type: {contentType}
            </div>
          ) : null}
          {parseError ? (
            <div className={isDark ? "mb-2 text-xs text-amber-300" : "mb-2 text-xs text-amber-700"}>
              N3 parse fallback: {parseError}
            </div>
          ) : null}
          {locationPoints.length > 0 ? (
            <div className="mb-4 space-y-2">
              <div className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-600"}>
                Map
              </div>
              <DescribeLocationMap isDark={isDark} points={locationPoints} />
              <div className={isDark ? "flex flex-wrap gap-3 text-xs text-gray-300" : "flex flex-wrap gap-3 text-xs text-gray-700"}>
                {locationPoints.map((point) => (
                  <div key={point.id} className="rounded-md border border-current/15 px-2 py-1">
                    <span className="font-medium">{point.label}</span>: {formatCoordinate(point.latitude)},{" "}
                    {formatCoordinate(point.longitude)}{" "}
                    <a className="underline" href={openStreetMapHref(point.latitude, point.longitude)} target="_blank" rel="noreferrer">
                      Open in OSM
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {quads.length > 0 ? (
            <div className="space-y-2">
              <div className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-600"}>
                {quads.length} triple{quads.length === 1 ? "" : "s"}
              </div>
              <div
                className={`max-h-[420px] overflow-auto rounded-lg border ${
                  isDark ? "border-gray-700 bg-black/40" : "border-gray-200 bg-white"
                }`}
              >
                <table className="w-full min-w-[820px] table-fixed border-collapse text-xs">
                  <colgroup>
                    {hasNamedGraph ? (
                      <>
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "36%" }} />
                        <col style={{ width: "16%" }} />
                      </>
                    ) : (
                      <>
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "44%" }} />
                      </>
                    )}
                  </colgroup>
                  <thead className={isDark ? "bg-gray-800/70 text-gray-200" : "bg-gray-100 text-gray-700"}>
                    <tr>
                      <th className="border-b border-inherit px-3 py-2 text-left font-medium">Subject</th>
                      <th className="border-b border-inherit px-3 py-2 text-left font-medium">Predicate</th>
                      <th className="border-b border-inherit px-3 py-2 text-left font-medium">Object</th>
                      {hasNamedGraph ? (
                        <th className="border-b border-inherit px-3 py-2 text-left font-medium">Graph</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {quads.map((quad, idx) => (
                      <tr key={`quad-${idx}`} className={isDark ? "border-t border-gray-700" : "border-t border-gray-200"}>
                        <td className="align-top px-3 py-2 whitespace-normal break-words">
                          {renderTerm(quad.subject, prefixEntries, isDark)}
                        </td>
                        <td className="align-top px-3 py-2 whitespace-normal break-words">
                          {renderTerm(quad.predicate, prefixEntries, isDark)}
                        </td>
                        <td className="align-top px-3 py-2 whitespace-normal break-words">
                          {renderTerm(quad.object, prefixEntries, isDark)}
                        </td>
                        {hasNamedGraph ? (
                          <td className="align-top px-3 py-2 whitespace-normal break-words">
                            {quad.graph ? renderTerm(quad.graph, prefixEntries, isDark) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Keep raw renderer as useful fallback for unsupported formats and debugging. */}
              <details>
                <summary className={`cursor-pointer text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Raw RDF
                </summary>
                <div className="mt-2">{renderRawRdf(body, effectivePrefixes, isDark)}</div>
              </details>
            </div>
          ) : (
            renderRawRdf(body, effectivePrefixes, isDark)
          )}
        </>
      ) : null}
    </section>
  );
}
