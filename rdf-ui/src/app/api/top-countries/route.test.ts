// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/topCountries", () => ({
  getCountries: vi.fn(),
}));

import { getCountries } from "@/lib/topCountries";
import { GET } from "./route";

const mockedGetCountries = vi.mocked(getCountries);

describe("GET /api/top-countries", () => {
  beforeEach(() => {
    mockedGetCountries.mockReset();
  });

  it("returns country payload with cache headers", async () => {
    const payload = {
      totalPapers: 12,
      rows: [{ name: "US", value: 5 }],
    };
    mockedGetCountries.mockResolvedValue(payload);

    const response = await GET(new Request("http://localhost/api/top-countries"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=2592000");
    expect(body).toEqual({ rows: payload });
  });

  it("returns 500 on downstream failures", async () => {
    mockedGetCountries.mockRejectedValue(new Error("failed to fetch"));

    const response = await GET(new Request("http://localhost/api/top-countries"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "failed to fetch" });
  });
});
