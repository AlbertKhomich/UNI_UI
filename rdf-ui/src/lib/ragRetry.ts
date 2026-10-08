export class RagStreamError extends Error {
  constructor(readonly code: string, readonly hasAnswerText = false, description?: string) {
    const detail = description?.trim() || (code === "llm_unavailable"
      ? "The AI service could not generate an answer. Please try again in a moment."
      : "");
    super(detail && detail !== code ? `${detail} (${code})` : code);
    this.name = "RagStreamError";
  }
}

export async function withRagSessionRetry<T>(
  authenticated: boolean,
  operation: () => Promise<T>,
  refreshSession: () => Promise<void>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RagStreamError && error.code === "llm_unavailable") {
      // A model failure does not invalidate the RAG session. Retry once for
      // guests and signed-in users, but never replay a partially shown answer.
      if (error.hasAnswerText) throw error;
      return operation();
    }
    if (!authenticated) throw error;
    await refreshSession();
    return operation();
  }
}
