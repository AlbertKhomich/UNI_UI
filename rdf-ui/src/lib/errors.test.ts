import { describe, expect, it } from "vitest";
import { bodyErrorMessage, normalizeErrorMessage, toErrorMessage } from "./errors";

describe("normalizeErrorMessage", () => {
  it("maps gateway timeout HTML pages to a readable message", () => {
    const html = [
      "<html>",
      "<head><title>504 Gateway Time-out</title></head>",
      "<body><center><h1>504 Gateway Time-out</h1></center><hr><center>nginx/1.22.1</center></body>",
      "</html>",
    ].join("");

    expect(normalizeErrorMessage(html)).toBe(
      "The data service timed out. Please try again in a moment.",
    );
  });

  it("maps upstream availability failures to a readable message", () => {
    expect(normalizeErrorMessage("SPARQL error 503: upstream failed")).toBe(
      "The data service is temporarily unavailable. Please try again in a moment.",
    );
  });

  it("strips HTML and preserves non-gateway messages", () => {
    expect(normalizeErrorMessage("<p>Paper not found</p>")).toBe("Paper not found");
  });
});

describe("toErrorMessage", () => {
  it("normalizes error instances", () => {
    expect(toErrorMessage(new Error("SPARQL error 504: timeout"))).toBe(
      "The data service timed out. Please try again in a moment.",
    );
  });
});

describe("bodyErrorMessage", () => {
  it("normalizes payload error fields", () => {
    expect(
      bodyErrorMessage({
        error: "<html><head><title>504 Gateway Time-out</title></head><body>oops</body></html>",
      }),
    ).toBe("The data service timed out. Please try again in a moment.");
  });
});
