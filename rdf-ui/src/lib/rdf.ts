import { Parser, type Quad, type Term } from "n3";
import { toErrorMessage } from "@/lib/errors";
import type { DescribeQuad, DescribeTerm } from "@/lib/types";

type ParsedDescribeData = {
  quads: DescribeQuad[];
  prefixes: Record<string, string>;
  parseError: string | null;
};

const KNOWN_PARSEABLE_MIME_TO_FORMAT: Record<string, string> = {
  "text/turtle": "text/turtle",
  "application/x-turtle": "text/turtle",
  "application/n-triples": "N-Triples",
  "application/n-quads": "N-Quads",
  "application/trig": "TriG",
  "text/n3": "N3",
};

const NON_PARSEABLE_MIME_HINTS = ["application/ld+json", "application/rdf+xml"];

function normalizeMimeType(contentType: string): string {
  return (contentType ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

function extractPrefixes(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const ttlMatch = line.match(/^\s*@prefix\s+([A-Za-z][\w-]*|)\s*:\s*<([^>]+)>/i);
    if (ttlMatch) {
      const key = (ttlMatch[1] ?? "").trim();
      const value = (ttlMatch[2] ?? "").trim();
      if (value) out[key] = value;
      continue;
    }

    const sparqlMatch = line.match(/^\s*prefix\s+([A-Za-z][\w-]*|)\s*:\s*<([^>]+)>/i);
    if (sparqlMatch) {
      const key = (sparqlMatch[1] ?? "").trim();
      const value = (sparqlMatch[2] ?? "").trim();
      if (value) out[key] = value;
    }
  }

  return out;
}

function toDescribeTerm(term: Term): DescribeTerm {
  if (term.termType === "NamedNode") {
    return {
      termType: "NamedNode",
      value: term.value,
    };
  }

  if (term.termType === "BlankNode") {
    return {
      termType: "BlankNode",
      value: term.value,
    };
  }

  if (term.termType === "Literal") {
    const out: DescribeTerm = {
      termType: "Literal",
      value: term.value,
    };
    if (term.language) out.language = term.language;
    if (term.datatype?.value) out.datatype = term.datatype.value;
    return out;
  }

  return {
    termType: "DefaultGraph",
    value: term.value ?? "",
  };
}

function toDescribeQuad(quad: Quad): DescribeQuad {
  const out: DescribeQuad = {
    subject: toDescribeTerm(quad.subject),
    predicate: toDescribeTerm(quad.predicate),
    object: toDescribeTerm(quad.object),
  };
  if (quad.graph.termType !== "DefaultGraph") out.graph = toDescribeTerm(quad.graph);
  return out;
}

function candidateFormatsByMime(mimeType: string): string[] {
  if (mimeType && KNOWN_PARSEABLE_MIME_TO_FORMAT[mimeType]) {
    return [KNOWN_PARSEABLE_MIME_TO_FORMAT[mimeType]];
  }

  if (mimeType.includes("turtle")) return ["text/turtle"];
  if (mimeType.includes("n-triples")) return ["N-Triples", "text/turtle"];
  if (mimeType.includes("n-quads")) return ["N-Quads", "TriG"];
  if (mimeType.includes("trig")) return ["TriG", "text/turtle"];
  if (mimeType.includes("n3")) return ["N3", "text/turtle"];

  // Some SPARQL endpoints return text/plain for n-triples.
  if (mimeType === "text/plain") return ["N-Triples", "text/turtle"];

  return ["text/turtle", "N-Triples"];
}

export function parseDescribeBodyWithN3(body: string, contentType: string): ParsedDescribeData | null {
  const rdf = (body ?? "").trim();
  if (!rdf) return { quads: [], prefixes: {}, parseError: null };

  const mimeType = normalizeMimeType(contentType);
  if (NON_PARSEABLE_MIME_HINTS.some((hint) => mimeType.includes(hint))) return null;

  const prefixes = extractPrefixes(rdf);
  let lastError: unknown = null;

  for (const format of candidateFormatsByMime(mimeType)) {
    try {
      const parser = new Parser({ format });
      const quads = parser.parse(rdf).map(toDescribeQuad);
      return {
        quads,
        prefixes,
        parseError: null,
      };
    } catch (error: unknown) {
      lastError = error;
    }
  }

  return {
    quads: [],
    prefixes,
    parseError: toErrorMessage(lastError, "Failed to parse RDF with N3"),
  };
}
