import { NextResponse } from "next/server";
import { getDemoRagSession, setDemoRagSession } from "@/lib/ragDemoSession";

const RAG_BASE_URL = process.env.RAG_BASE_URL ?? "https://rag.trr318.dice-research.org";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, keys: string[]): string {
  if (!isRecord(value)) return "";
  for (const key of keys) {
    const next = value[key];
    if (typeof next === "string" && next.trim()) return next.trim();
  }
  return "";
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return { text: await response.text() };
}

async function toProxyError(response: Response, fallback: string): Promise<NextResponse> {
  let payload: unknown = null;
  try {
    payload = await readJsonResponse(response);
  } catch {
    payload = null;
  }

  const message = isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : `${fallback} (HTTP ${response.status})`;

  return NextResponse.json({ error: message, upstream: payload }, { status: response.status });
}

export async function ensureDemoRagSession() {
  const current = getDemoRagSession();
  if (current) return current;

  const response = await fetch(`${RAG_BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        ttl_seconds: 3153600000,
        sparql_endpoint: "http://131.234.26.202:9080/sparql",
        embedding: { device: "cpu" },
      },
    }),
  });

  if (!response.ok) throw await toProxyError(response, "Failed to create RAG session");

  const payload = await readJsonResponse(response);
  const id = readString(payload, ["id", "session_id", "sessionId"]);
  const token = readString(payload, ["token", "access_token", "accessToken"]);

  if (!id || !token) {
    throw NextResponse.json(
      { error: "RAG session response did not include an id and token.", upstream: payload },
      { status: 502 },
    );
  }

  return setDemoRagSession({ id, token });
}

export async function requireDemoRagSession() {
  const session = getDemoRagSession();
  if (session) return session;

  throw NextResponse.json({ error: "No RAG session has been created yet." }, { status: 409 });
}

export async function proxyRagResponse(response: Response, fallback: string): Promise<NextResponse> {
  if (!response.ok) return toProxyError(response, fallback);
  const payload = await readJsonResponse(response);
  return NextResponse.json(payload);
}

export function ragUrl(path: string): string {
  return `${RAG_BASE_URL}${path}`;
}
