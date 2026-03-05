"use client";

import { useEffect, useState } from "react";
import { bodyErrorMessage, toErrorMessage } from "@/lib/errors";
import type { DescribeQuad, DescribeResponse } from "@/lib/types";

type UseDescribeStateArgs = {
  iri: string | null;
};

export function useDescribeState({ iri }: UseDescribeStateArgs) {
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [prefixes, setPrefixes] = useState<Record<string, string>>({});
  const [quads, setQuads] = useState<DescribeQuad[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toStringRecord(input: unknown): Record<string, string> {
    if (!input || typeof input !== "object") return {};

    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof key === "string" && typeof value === "string" && value.trim()) {
        out[key] = value;
      }
    }
    return out;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDescribe() {
      if (!iri) {
        setBody("");
        setContentType("");
        setParseError(null);
        setPrefixes({});
        setQuads([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setBody("");
      setContentType("");
      setParseError(null);
      setPrefixes({});
      setQuads([]);

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
          setQuads(Array.isArray(describePayload.quads) ? describePayload.quads : []);
          setPrefixes(toStringRecord(describePayload.prefixes));
          setParseError(typeof describePayload.parseError === "string" ? describePayload.parseError : null);
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
    parseError,
    prefixes,
    quads,
  };
}
