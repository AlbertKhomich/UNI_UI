import { describe, expect, it } from "vitest";
import { toDisplayName } from "./format";

describe("toDisplayName", () => {
  it("converts 'last, first' into 'first last'", () => {
    expect(toDisplayName("Doe, Jane")).toBe("Jane Doe");
  });

  it("keeps additional given names in order", () => {
    expect(toDisplayName("Doe, Jane Alice")).toBe("Jane Alice Doe");
  });

  it("returns trimmed input if no comma is present", () => {
    expect(toDisplayName("  Jane Doe  ")).toBe("Jane Doe");
  });
});
