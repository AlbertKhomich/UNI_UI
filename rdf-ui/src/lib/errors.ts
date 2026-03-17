const MAX_MESSAGE_LENGTH = 220;

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(input: string): string {
  return input.length > MAX_MESSAGE_LENGTH ? `${input.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}...` : input;
}

export function normalizeErrorMessage(input: string, fallback = "Error"): string {
  const raw = (input ?? "").trim();
  if (!raw) return fallback;

  const clean = truncate(stripHtml(raw));
  const source = clean || raw;
  const lower = source.toLowerCase();

  if (
    lower.includes("504 gateway time-out") ||
    lower.includes("504 gateway timeout") ||
    lower.includes("http 504") ||
    lower.includes("error 504")
  ) {
    return "The data service timed out. Please try again in a moment.";
  }

  if (
    lower.includes("502 bad gateway") ||
    lower.includes("503 service unavailable") ||
    lower.includes("http 502") ||
    lower.includes("http 503") ||
    lower.includes("error 502") ||
    lower.includes("error 503")
  ) {
    return "The data service is temporarily unavailable. Please try again in a moment.";
  }

  return clean || fallback;
}

export function toErrorMessage(error: unknown, fallback = "Error"): string {
  if (error instanceof Error && error.message) return normalizeErrorMessage(error.message, fallback);
  if (typeof error === "string" && error) return normalizeErrorMessage(error, fallback);
  return fallback;
}

export function bodyErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = (payload as { error?: unknown }).error;
  if (typeof candidate !== "string" || !candidate) return null;
  return normalizeErrorMessage(candidate);
}
