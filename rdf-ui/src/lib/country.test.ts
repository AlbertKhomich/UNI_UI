import { describe, expect, it } from "vitest";
import { toCountryCode } from "./country";

describe("toCountryCode", () => {
  it("resolves aliases and canonical code aliases", () => {
    expect(toCountryCode("usa")).toBe("US");
    expect(toCountryCode("FX")).toBe("FR");
  });

  it("ignores non-country two-letter tokens in free text", () => {
    expect(toCountryCode("University of Bonn")).toBe("");
  });

  it("still resolves explicit valid country codes in text", () => {
    expect(toCountryCode("University of Bonn, DE")).toBe("DE");
  });
});
