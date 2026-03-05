export type CountryIndexEntry = {
  code: string;
  normalizedName: string;
};

export const COUNTRY_ALIASES: Record<string, string[]> = {
  us: ["US"],
  usa: ["US"],
  "united states": ["US"],
  "united states of america": ["US"],
  uk: ["GB"],
  "united kingdom": ["GB"],
  "great britain": ["GB"],
  uae: ["AE"],
  "south korea": ["KR"],
  "north korea": ["KP"],
  russia: ["RU"],
  "czech republic": ["CZ"],
  "ivory coast": ["CI"],
};

export const COUNTRY_CODE_ALIASES: Record<string, string> = {
  FX: "FR",
};

export function normalizeCountryLookup(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function canonicalizeCountryCode(input: string): string {
  const code = (input ?? "").trim().toUpperCase();
  if (!code) return "";
  return COUNTRY_CODE_ALIASES[code] ?? code;
}

export function buildCountryIndex(): CountryIndexEntry[] {
  let displayNames: Intl.DisplayNames | null = null;

  try {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return [];
  }

  const rows: CountryIndexEntry[] = [];
  for (let i = 65; i <= 90; i += 1) {
    for (let j = 65; j <= 90; j += 1) {
      const code = `${String.fromCharCode(i)}${String.fromCharCode(j)}`;
      const name = displayNames.of(code);
      if (!name) continue;
      if (name.toUpperCase() === code) continue;
      rows.push({
        code,
        normalizedName: normalizeCountryLookup(name),
      });
    }
  }

  return rows;
}

const COUNTRY_INDEX = buildCountryIndex();
const KNOWN_COUNTRY_CODES = new Set<string>(COUNTRY_INDEX.map((entry) => entry.code));

const COUNTRY_NAME_TO_CODE: Map<string, string> = (() => {
  const out = new Map<string, string>();
  for (const entry of COUNTRY_INDEX) out.set(entry.normalizedName, entry.code);
  return out;
})();

function isKnownCountryCode(code: string): boolean {
  if (!/^[A-Z]{2}$/.test(code)) return false;
  if (KNOWN_COUNTRY_CODES.size === 0) return true;
  return KNOWN_COUNTRY_CODES.has(code);
}

export function countryCodeToFlag(input: string): string {
  const code = canonicalizeCountryCode(input);
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const A = 0x1f1e6;
  const first = A + (code.charCodeAt(0) - 65);
  const second = A + (code.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}

export function countryCodeToName(input: string, locale = "en"): string {
  const code = canonicalizeCountryCode(input);
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

export function toCountryCode(input: string): string {
  const value = (input ?? "").trim();
  if (!value) return "";

  const directCodes = value.toUpperCase().match(/\b[A-Z]{2}\b/g) ?? [];
  for (const directCode of directCodes) {
    const canonical = canonicalizeCountryCode(directCode);
    if (isKnownCountryCode(canonical)) return canonical;
  }

  const compact = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (/^[A-Z]{2}$/.test(compact)) {
    const canonical = canonicalizeCountryCode(compact);
    if (isKnownCountryCode(canonical)) return canonical;
  }

  const normalized = normalizeCountryLookup(value);
  if (!normalized) return "";

  const aliased = COUNTRY_ALIASES[normalized]?.[0];
  if (aliased) return canonicalizeCountryCode(aliased);

  const fromName = COUNTRY_NAME_TO_CODE.get(normalized);
  return fromName ? canonicalizeCountryCode(fromName) : "";
}
