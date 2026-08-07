// @vitest-environment node

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import {
  ensureRagSessionForRequest,
  ensureUserRagSession,
  resetUserRagSession,
  requireUserRagSession,
} from "./_lib";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

const TEST_EMAIL_PREFIX = "rag-isolation-test-";
const USER_A_EMAIL = `${TEST_EMAIL_PREFIX}a@example.com`;
const USER_B_EMAIL = `${TEST_EMAIL_PREFIX}b@example.com`;
let testDatabaseIsSafe = false;

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured for RAG isolation tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `RAG isolation tests refuse to modify non-test database "${databaseName}".`,
    );
  }

  testDatabaseIsSafe = true;
}

async function removeTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
}

function authenticateAs(email: string): void {
  vi.mocked(getServerSession).mockResolvedValue({
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: { email },
  });
}

function mockCreatedRagSession(id: string, token: string): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    Response.json({ id, token }, { status: 201 }),
  ));
}

describe("per-user RAG session isolation", () => {
  beforeAll(async () => {
    assertTestDatabase();
    await prisma.$connect();
  });

  beforeEach(async () => {
    vi.stubEnv("X-ISSUER-TOKEN", "test-issuer-token");
    await removeTestUsers();
    await prisma.user.createMany({
      data: [
        { email: USER_A_EMAIL, passwordHash: "not-used-by-this-test" },
        { email: USER_B_EMAIL, passwordHash: "not-used-by-this-test" },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    if (testDatabaseIsSafe) {
      await removeTestUsers();
    }
    await prisma.$disconnect();
  });

  it("creates and persists a RAG session for the authenticated user", async () => {
    authenticateAs(USER_A_EMAIL);
    mockCreatedRagSession("session-a", "token-a");

    await expect(ensureUserRagSession()).resolves.toEqual({
      id: "session-a",
      token: "token-a",
    });

    const userA = await prisma.user.findUniqueOrThrow({ where: { email: USER_A_EMAIL } });
    const userB = await prisma.user.findUniqueOrThrow({ where: { email: USER_B_EMAIL } });
    expect(userA).toMatchObject({ ragSessionId: "session-a", ragSessionToken: "token-a" });
    expect(userB).toMatchObject({ ragSessionId: null, ragSessionToken: null });
  });

  it("reuses the authenticated user's stored RAG session", async () => {
    authenticateAs(USER_A_EMAIL);
    mockCreatedRagSession("session-a", "token-a");

    await ensureUserRagSession();
    await expect(ensureUserRagSession()).resolves.toEqual({
      id: "session-a",
      token: "token-a",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps two authenticated users on distinct RAG sessions", async () => {
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: "session-a", token: "token-a" }))
      .mockResolvedValueOnce(Response.json({ id: "session-b", token: "token-b" }));
    vi.stubGlobal("fetch", upstreamFetch);

    authenticateAs(USER_A_EMAIL);
    await ensureUserRagSession();
    authenticateAs(USER_B_EMAIL);
    await ensureUserRagSession();

    authenticateAs(USER_A_EMAIL);
    await expect(requireUserRagSession()).resolves.toEqual({ id: "session-a", token: "token-a" });
    authenticateAs(USER_B_EMAIL);
    await expect(requireUserRagSession()).resolves.toEqual({ id: "session-b", token: "token-b" });
  });

  it("rejects requests without an authenticated user", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const error = await ensureUserRagSession().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(401);
  });

  it("deletes the previous user session and persists a fresh one", async () => {
    authenticateAs(USER_A_EMAIL);
    await prisma.user.update({
      where: { email: USER_A_EMAIL },
      data: { ragSessionId: "old-session", ragSessionToken: "old-token" },
    });
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ id: "new-session", token: "new-token" }));
    vi.stubGlobal("fetch", upstreamFetch);

    await expect(resetUserRagSession()).resolves.toEqual({
      id: "new-session",
      token: "new-token",
    });

    expect(upstreamFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/sessions/old-session"),
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: "Bearer old-token" },
      }),
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { email: USER_A_EMAIL } });
    expect(user).toMatchObject({
      ragSessionId: "new-session",
      ragSessionToken: "new-token",
    });
  });

  it("keeps a reusable demo session for anonymous AI requests", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    mockCreatedRagSession("demo-session", "demo-token");

    await expect(ensureRagSessionForRequest()).resolves.toEqual({
      id: "demo-session",
      token: "demo-token",
    });
    await expect(ensureRagSessionForRequest()).resolves.toEqual({
      id: "demo-session",
      token: "demo-token",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
