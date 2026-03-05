const PAPER_OR_VENUE_PATH_REGEX = /\/id\/(?:publication|venue)(?:\/|$)/i;
const PERSON_PATH_REGEX = /\/(?:id\/person|orcid)(?:\/|$)/i;
const ORGANIZATION_PATH_REGEX = /\/(?:id\/org|ror|openalex_org)(?:\/|$)/i;
const DIRECT_URI_FILTER_QUERY_REGEX = /^\s*(?:a|author|aff|af|affiliation)\s*:\s*(<)?(https?:\/\/\S+?)\1?\s*$/i;
const DIRECT_URI_QUERY_REGEX = /^\s*(<)?(https?:\/\/\S+?)\1?\s*$/i;
const CANONICAL_UPBKG_ORIGIN = "http://upbkg.data.dice-research.org";
const CANONICALIZABLE_RDF_PATH_REGEX =
  /\/(?:id\/(?:person|org|publication|venue)|orcid|ror|openalex_org)(?:\/|$)/i;
const AUTHOR_RESOURCE_PATH_REGEX = /^\/id\/(?:person|author)\/(hash|uni)\/([^\/?#]+)$/i;
const AUTHOR_HOST_VARIANTS = ["upbkg.data.dice-research.org", "dice-research.org"] as const;
const AUTHOR_SCHEME_VARIANTS = ["http", "https"] as const;

export type LocationLike = {
  search: string;
  pathname: string;
  origin: string;
};

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function normalizeIriInput(input: string): string {
  return (input ?? "")
    .trim()
    .replace(/^<|>$/g, "")
    .replace(/[)>.,;]+$/, "");
}

export function canonicalizeUpbkgIri(input: string): string {
  const raw = normalizeIriInput(input);
  if (!raw) return "";

  const parsed = parseUrl(raw);
  if (!parsed) return raw;
  if (!CANONICALIZABLE_RDF_PATH_REGEX.test(parsed.pathname)) return raw;
  return `${CANONICAL_UPBKG_ORIGIN}${parsed.pathname}`;
}

export function extractDirectAuthorIri(input: string): string | null {
  const m = input.match(/^\s*(?:a|author)\s*:\s*(<)?(https?:\/\/\S+?)\1?\s*$/i);
  if (!m?.[2]) return null;
  return m[2].trim().replace(/[)>.,;]+$/, "");
}

export function buildAuthorIriCandidates(input: string): string[] {
  const iri = canonicalizeUpbkgIri(input);
  if (!iri) return [];

  const parsed = parseUrl(iri);
  if (!parsed) return [iri];

  const m = parsed.pathname.match(AUTHOR_RESOURCE_PATH_REGEX);
  if (!m?.[1] || !m[2]) return [iri];

  const bucket = m[1].toLowerCase();
  const authorId = m[2];
  const candidates = new Set<string>([
    iri,
    `${parsed.protocol}//${parsed.host}/id/person/${bucket}/${authorId}`,
    `${parsed.protocol}//${parsed.host}/id/author/${bucket}/${authorId}`,
  ]);

  for (const scheme of AUTHOR_SCHEME_VARIANTS) {
    for (const host of AUTHOR_HOST_VARIANTS) {
      candidates.add(`${scheme}://${host}/id/person/${bucket}/${authorId}`);
      candidates.add(`${scheme}://${host}/id/author/${bucket}/${authorId}`);
    }
  }

  return Array.from(candidates);
}

export function assignAuthorNameByIriVariants(
  target: Record<string, string>,
  iri: string,
  name: string,
): void {
  const trimmedName = (name ?? "").trim();
  if (!trimmedName) return;

  for (const candidate of buildAuthorIriCandidates(iri)) {
    target[candidate] = trimmedName;
  }
}

export function getKnownAuthorNameByIriVariants(
  knownAuthorNames: Record<string, string>,
  iri: string,
): string {
  for (const candidate of buildAuthorIriCandidates(iri)) {
    const name = knownAuthorNames[candidate];
    if (name) return name;
  }
  return "";
}

export function toSearchQueryFromIri(input: string): string {
  const iri = canonicalizeUpbkgIri(input);
  if (!iri) return "";

  const parsed = parseUrl(iri);
  if (!parsed) return iri;

  const path = parsed.pathname;
  if (PERSON_PATH_REGEX.test(path)) return `a: ${iri}`;
  if (ORGANIZATION_PATH_REGEX.test(path)) return `aff: ${iri}`;
  if (PAPER_OR_VENUE_PATH_REGEX.test(path)) return iri;
  return iri;
}

export function toDescribeIri(input: string): string | null {
  const iri = canonicalizeUpbkgIri(input);
  if (!iri) return null;

  const parsed = parseUrl(iri);
  if (!parsed) return null;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

export function extractDescribeIriFromSearchQuery(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const filtered = raw.match(DIRECT_URI_FILTER_QUERY_REGEX);
  if (filtered?.[2]) return toDescribeIri(filtered[2].replace(/[)>.,;]+$/, ""));

  const plain = raw.match(DIRECT_URI_QUERY_REGEX);
  if (plain?.[2]) return toDescribeIri(plain[2].replace(/[)>.,;]+$/, ""));

  return null;
}

export function initialQueryFromLocation(loc: LocationLike): string {
  const params = new URLSearchParams(loc.search);
  const directQ = (params.get("q") ?? "").trim();

  // Keep direct URI-driven search auto-mapping disabled for browse-first navigation.
  // Useful for future if we need to restore old behavior:
  // if (extractDescribeIriFromSearchQuery(directQ)) return toSearchQueryFromIri(directQ);
  if (extractDescribeIriFromSearchQuery(directQ)) return "";
  return directQ;
}

export function initialDescribeIriFromLocation(loc: LocationLike): string | null {
  const params = new URLSearchParams(loc.search);
  const directQ = (params.get("q") ?? "").trim();
  if (directQ) return extractDescribeIriFromSearchQuery(directQ);

  const uriParam = (params.get("uri") ?? params.get("iri") ?? "").trim();
  if (uriParam) return toDescribeIri(uriParam);

  if (!loc.pathname || loc.pathname === "/" || loc.pathname.startsWith("/api/")) return null;

  // Browse-first mode: path-based navigation should resolve against canonical UPBKG host.
  const canonicalPathIri = `${CANONICAL_UPBKG_ORIGIN}${loc.pathname}`;
  const canonical = toDescribeIri(canonicalPathIri);
  if (canonical) return canonical;

  // Useful fallback for future non-UPBKG deployments:
  // const pathIri = `${loc.origin}${loc.pathname}`;
  // return toDescribeIri(pathIri);
  return null;
}

export function isGithubUrl(input: string): boolean {
  const parsed = parseUrl(input);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === "github.com" || host.endsWith(".github.com");
}
