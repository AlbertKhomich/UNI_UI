const CANONICAL_UPBKG_ORIGIN = "http://upbkg.data.dice-research.org";

export function paperIriFromId(id: string): string {
  const clean = (id ?? "").trim().replace(/^\/+/, "").replace(/[)>.,;]+$/, "");
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${CANONICAL_UPBKG_ORIGIN}/id/publication/ris/${clean}`;
}
