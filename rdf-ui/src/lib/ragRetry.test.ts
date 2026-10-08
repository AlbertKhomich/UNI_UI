import { describe, expect, it, vi } from "vitest";
import { RagStreamError, withRagSessionRetry } from "./ragRetry";

describe("RAG request recovery", () => {
  it.each([false, true])("retries model unavailability without replacing the session (authenticated=%s)", async (authenticated) => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new RagStreamError("llm_unavailable"))
      .mockResolvedValueOnce("answer");
    const refresh = vi.fn();
    await expect(withRagSessionRetry(authenticated, operation, refresh)).resolves.toBe("answer");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("surfaces a persistent model failure after one retry", async () => {
    const error = new RagStreamError("llm_unavailable");
    const operation = vi.fn().mockRejectedValue(error);
    const refresh = vi.fn();
    await expect(withRagSessionRetry(false, operation, refresh)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([false, true])("does not replay a partial answer (authenticated=%s)", async (authenticated) => {
    const error = new RagStreamError("llm_unavailable", true);
    const operation = vi.fn().mockRejectedValue(error);
    const refresh = vi.fn();
    await expect(withRagSessionRetry(authenticated, operation, refresh)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not retry unrelated guest errors", async () => {
    const error = new Error("Missing session");
    const operation = vi.fn().mockRejectedValue(error);
    const refresh = vi.fn();
    await expect(withRagSessionRetry(false, operation, refresh)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("preserves existing authenticated session recovery for other errors", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error("Expired session")).mockResolvedValueOnce("answer");
    const refresh = vi.fn().mockResolvedValue(undefined);
    await expect(withRagSessionRetry(true, operation, refresh)).resolves.toBe("answer");
    expect(refresh).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
