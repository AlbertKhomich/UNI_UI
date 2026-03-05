const PAPER_OR_VENUE_PATH_REGEX = /\/id\/(?:publication|venue)(?:\/|$)/i;
const PERSON_PATH_REGEX = /\/(?:id\/person|orcid)(?:\/|$)/i;
const ORGANIZATION_PATH_REGEX = /\/(?:id\/org|ror|openalex_org)(?:\/|$)/i;
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

export function initialQueryFromLocation(loc: LocationLike): string {
  const params = new URLSearchParams(loc.search);
  const directQ = (params.get("q") ?? "").trim();
  if (directQ) return directQ;

  const uriParam = (params.get("uri") ?? params.get("iri") ?? "").trim();
  if (uriParam) return toSearchQueryFromIri(uriParam);

  if (!loc.pathname || loc.pathname === "/" || loc.pathname.startsWith("/api/")) return "";
  const pathIri = `${loc.origin}${loc.pathname}`;
  return toSearchQueryFromIri(pathIri);
}

export function isGithubUrl(input: string): boolean {
  const parsed = parseUrl(input);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === "github.com" || host.endsWith(".github.com");
}
