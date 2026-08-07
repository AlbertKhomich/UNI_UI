import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDemoRagSession, setDemoRagSession, type RagSession } from "@/lib/ragDemoSession";

const RAG_BASE_URL = process.env.RAG_BASE_URL ?? "https://rag.trr318.dice-research.org";

type JsonRecord = Record<string, unknown>;
type CurrentUser = {
  id: string;
  ragSessionId: string | null;
  ragSessionToken: string | null;
};

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

async function getCurrentUser(): Promise<CurrentUser | null> {
  const authSession = await getServerSession(authOptions);
  const email = authSession?.user?.email?.trim().toLowerCase();

  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      ragSessionId: true,
      ragSessionToken: true,
    },
  });

  if (!user) {
    throw NextResponse.json({ error: "Authenticated user no longer exists." }, { status: 401 });
  }

  return user;
}

async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;

  throw NextResponse.json({ error: "Authentication is required." }, { status: 401 });
}

function storedRagSession(user: {
  ragSessionId: string | null;
  ragSessionToken: string | null;
}): RagSession | null {
  if (!user.ragSessionId || !user.ragSessionToken) return null;
  return { id: user.ragSessionId, token: user.ragSessionToken };
}

async function createRagSession(): Promise<RagSession> {
  const issuerToken = process.env["X-ISSUER-TOKEN"]?.trim();
  if (!issuerToken) {
    throw new Error("X-ISSUER-TOKEN is not configured.");
  }

  const response = await fetch(`${RAG_BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Issuer-Token": issuerToken,
    },
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

  return { id, token };
}

async function ensureRagSessionForUser(user: CurrentUser): Promise<RagSession> {
  const current = storedRagSession(user);
  if (current) return current;

  const created = await createRagSession();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      ragSessionId: created.id,
      ragSessionToken: created.token,
    },
  });

  return created;
}

export async function ensureUserRagSession(): Promise<RagSession> {
  return ensureRagSessionForUser(await requireCurrentUser());
}

export async function requireUserRagSession(): Promise<RagSession> {
  const user = await requireCurrentUser();
  const session = storedRagSession(user);
  if (session) return session;

  throw NextResponse.json({ error: "No RAG session has been created for this user yet." }, { status: 409 });
}

export async function resetUserRagSession(): Promise<RagSession> {
  const user = await requireCurrentUser();
  const current = storedRagSession(user);

  if (current) {
    const response = await fetch(ragUrl(`/sessions/${encodeURIComponent(current.id)}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${current.token}` },
    });

    if (!response.ok) {
      throw await toProxyError(response, "Failed to delete the previous RAG session");
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ragSessionId: null,
      ragSessionToken: null,
    },
  });

  return ensureRagSessionForUser({
    ...user,
    ragSessionId: null,
    ragSessionToken: null,
  });
}

export async function ensureRagSessionForRequest(): Promise<RagSession> {
  const user = await getCurrentUser();
  if (user) return ensureRagSessionForUser(user);

  const demoSession = getDemoRagSession();
  if (demoSession) return demoSession;

  return setDemoRagSession(await createRagSession());
}

export async function requireRagSessionForRequest(): Promise<RagSession> {
  const user = await getCurrentUser();
  if (user) {
    const session = storedRagSession(user);
    if (session) return session;
    throw NextResponse.json(
      { error: "No RAG session has been created for this user yet." },
      { status: 409 },
    );
  }

  const demoSession = getDemoRagSession();
  if (demoSession) return demoSession;
  throw NextResponse.json({ error: "No demo RAG session has been created yet." }, { status: 409 });
}

export async function proxyRagResponse(response: Response, fallback: string): Promise<NextResponse> {
  if (!response.ok) return toProxyError(response, fallback);
  const payload = await readJsonResponse(response);
  return NextResponse.json(payload);
}

export function ragUrl(path: string): string {
  return `${RAG_BASE_URL}${path}`;
}
