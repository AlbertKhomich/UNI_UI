export function toErrorMessage(error: unknown, fallback = "Error"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function bodyErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = (payload as { error?: unknown }).error;
  if (typeof candidate !== "string" || !candidate) return null;
  return candidate;
}
