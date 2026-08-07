// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/register/route";
import { authorizeCredentials } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TEST_EMAIL_PREFIX = "auth-pipeline-test-";
const TEST_EMAIL = `${TEST_EMAIL_PREFIX}user@example.com`;
const TEST_PASSWORD = "correct-horse-battery-staple";
let testDatabaseIsSafe = false;

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured for authentication tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Authentication tests refuse to modify non-test database "${databaseName}".`,
    );
  }

  testDatabaseIsSafe = true;
}

async function removeTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
}

describe("credentials authentication pipeline", () => {
  beforeAll(async () => {
    assertTestDatabase();
    await prisma.$connect();
    await removeTestUsers();

    const response = await register(
      new Request("http://localhost/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: TEST_EMAIL.toUpperCase(),
          password: TEST_PASSWORD,
          confirmPassword: TEST_PASSWORD,
          terms: true,
        }),
      }),
    );

    if (response.status !== 201) {
      throw new Error(`Unable to arrange authentication test user (HTTP ${response.status}).`);
    }
  });

  afterAll(async () => {
    if (testDatabaseIsSafe) {
      await removeTestUsers();
    }
    await prisma.$disconnect();
  });

  it("authenticates an account created by the registration endpoint", async () => {
    const user = await authorizeCredentials({
      email: `  ${TEST_EMAIL.toUpperCase()}  `,
      password: TEST_PASSWORD,
    });

    expect(user).toMatchObject({ email: TEST_EMAIL });
    expect(user?.id).toEqual(expect.any(String));
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("rejects an incorrect password", async () => {
    await expect(
      authorizeCredentials({ email: TEST_EMAIL, password: "incorrect-password" }),
    ).resolves.toBeNull();
  });

  it("rejects an unknown account", async () => {
    await expect(
      authorizeCredentials({
        email: `${TEST_EMAIL_PREFIX}missing@example.com`,
        password: TEST_PASSWORD,
      }),
    ).resolves.toBeNull();
  });

  it("rejects malformed credentials before querying for a session user", async () => {
    await expect(
      authorizeCredentials({ email: "not-an-email", password: "" }),
    ).resolves.toBeNull();
  });
});
