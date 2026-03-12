import { describe, expect, it } from "vitest";
import { countryAlpha3ToCode, countryCodeToAlpha3, toCountryCode } from "./country";

describe("toCountryCode", () => {
  it("maps alpha-2 and alpha-3 codes in both directions", () => {
    expect(countryCodeToAlpha3("US")).toBe("USA");
    expect(countryCodeToAlpha3("FX")).toBe("FRA");
    expect(countryAlpha3ToCode("DEU")).toBe("DE");
  });

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
