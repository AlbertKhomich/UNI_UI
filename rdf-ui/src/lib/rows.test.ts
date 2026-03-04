import { describe, expect, it } from "vitest";
import { packTailIntoOther } from "./rows";

describe("packTailIntoOther", () => {
  it("packs a small tail into a single 'Other' row", () => {
    const result = packTailIntoOther(
      [
        { name: "US", value: 10 },
        { name: "DE", value: 4 },
        { name: "FR", value: 2 },
        { name: "GB", value: 1 },
      ],
      { otherLabel: "Other", otherColor: "rgba(0,0,0,0.3)", minItemsKeep: 2 },
    );

    expect(result).toEqual([
      { name: "US", value: 10 },
      { name: "DE", value: 4 },
      { name: "Other", value: 3, color: "rgba(0,0,0,0.3)" },
    ]);
  });

  it("returns sorted rows unchanged when no valid cutoff exists", () => {
    const result = packTailIntoOther([
      { name: "B", value: 5 },
      { name: "A", value: 9 },
      { name: "C", value: 5 },
    ]);

    expect(result).toEqual([
      { name: "A", value: 9 },
      { name: "B", value: 5 },
      { name: "C", value: 5 },
    ]);
  });

  it("returns the original array when row count is at or below minItemsKeep", () => {
    const input = [
      { name: "US", value: 2 },
      { name: "DE", value: 1 },
    ];

    expect(packTailIntoOther(input, { minItemsKeep: 2 })).toBe(input);
  });
});
