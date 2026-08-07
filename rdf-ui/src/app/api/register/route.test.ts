// @vitest-environment node

import { compare } from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const TEST_EMAIL_PREFIX = "registration-test-";
const VALID_PASSWORD = "correct-horse-battery-staple";
let testDatabaseIsSafe = false;

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured for registration tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Registration tests refuse to modify non-test database "${databaseName}".`,
    );
  }

  testDatabaseIsSafe = true;
}

async function removeTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      email: { startsWith: TEST_EMAIL_PREFIX },
    },
  });
}

async function registerUser(values: Partial<{
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}> = {}) {
  const body = {
    email: `${TEST_EMAIL_PREFIX}default@example.com`,
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    terms: true,
    ...values,
  };

  return POST(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/register", () => {
  beforeAll(async () => {
    assertTestDatabase();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await removeTestUsers();
  });

  afterAll(async () => {
    if (testDatabaseIsSafe) {
      await removeTestUsers();
    }
    await prisma.$disconnect();
  });

  it("creates a user with the normalized email and only a password hash", async () => {
    const email = `${TEST_EMAIL_PREFIX}SUCCESS@Example.com`;
    const normalizedEmail = email.toLowerCase();

    const response = await registerUser({ email });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      success: true,
      user: { email: normalizedEmail },
    });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    expect(user).not.toBeNull();
    expect(user?.email).toBe(normalizedEmail);
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe(VALID_PASSWORD);
    await expect(compare(VALID_PASSWORD, user?.passwordHash ?? "")).resolves.toBe(true);
    expect(JSON.stringify(user)).not.toContain(VALID_PASSWORD);
    expect(JSON.stringify(body)).not.toContain(VALID_PASSWORD);
  });

  it("rejects an invalid email without creating a user", async () => {
    const response = await registerUser({ email: "not-an-email" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.email).toContain("Enter a valid email address.");
    await expect(prisma.user.count({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    })).resolves.toBe(0);
  });

  it("rejects a password shorter than eight characters", async () => {
    const response = await registerUser({
      password: "short",
      confirmPassword: "short",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.password).toContain(
      "Password must be at least 8 characters.",
    );
  });

  it("rejects registering the same normalized email twice", async () => {
    const email = `${TEST_EMAIL_PREFIX}duplicate@example.com`;

    const firstResponse = await registerUser({ email });
    const secondResponse = await registerUser({ email: email.toUpperCase() });
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(409);
    expect(secondBody).toEqual({
      error: "An account with this email already exists.",
    });
    await expect(prisma.user.count({
      where: { email },
    })).resolves.toBe(1);
  });
});

