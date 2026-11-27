import { describe, expect, it } from "vitest";
import { parseEstimatedYearRange } from "./estimatedYearRange";

describe("parseEstimatedYearRange", () => {
  it.each([
    ["1940-1945", 1940, 1945],
    ["1940 – 1945", 1940, 1945],
    ["1940–1945", 1940, 1945],
    [" 1940   -   1945 ", 1940, 1945],
    ["1940—1945", 1940, 1945],
  ])("parses %s", (input, startYear, endYear) => {
    expect(parseEstimatedYearRange(input)).toEqual({ startYear, endYear });
  });

  it.each(["", "1940", "1940 to 1945", "1940--1945", "abcd-1945", "0-1945"])(
    "rejects invalid input: %s",
    (input) => {
      expect(() => parseEstimatedYearRange(input)).toThrow();
    },
  );

  it("rejects a reversed range with an actionable message", () => {
    expect(() => parseEstimatedYearRange("1945-1940")).toThrow(
      "The start year must be earlier than or equal to the end year.",
    );
  });
});
