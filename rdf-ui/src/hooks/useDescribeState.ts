"use client";

import { useEffect, useState } from "react";
import { bodyErrorMessage, toErrorMessage } from "@/lib/errors";
import type { DescribeResponse } from "@/lib/types";

type UseDescribeStateArgs = {
  iri: string | null;
};

export function useDescribeState({ iri }: UseDescribeStateArgs) {
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDescribe() {
      if (!iri) {
        setBody("");
        setContentType("");
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setBody("");
      setContentType("");

      try {
        const response = await fetch(`/api/describe?iri=${encodeURIComponent(iri)}`);
        const contentTypeHeader = response.headers.get("content-type") ?? "";

        let payload: unknown = null;
        if (contentTypeHeader.includes("application/json")) {
          payload = await response.json();
        } else {
          payload = { error: `Unexpected response format (${contentTypeHeader || "unknown"})` };
        }

        if (!response.ok) throw new Error(bodyErrorMessage(payload) ?? `Describe failed (HTTP ${response.status})`);
        if (!payload || typeof payload !== "object") throw new Error("Describe failed");

        const describePayload = payload as DescribeResponse;
        if (!cancelled) {
          setBody(typeof describePayload.body === "string" ? describePayload.body : "");
          setContentType(typeof describePayload.contentType === "string" ? describePayload.contentType : "");
        }
      } catch (nextError: unknown) {
        if (!cancelled) setError(toErrorMessage(nextError, "Describe failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDescribe();
    return () => {
      cancelled = true;
    };
  }, [iri]);

  return {
    body,
    contentType,
    error,
    loading,
  };
}
