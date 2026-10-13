import { describe, expect, it } from "vitest";
import { dedupeTrimmedIds, isQueryFlagTrue, paginateArray } from "../core/paginationUtils.js";

describe("isQueryFlagTrue", () => {
  it("returns true for boolean true and numeric 1", () => {
    expect(isQueryFlagTrue(true)).toBe(true);
    expect(isQueryFlagTrue(1)).toBe(true);
  });

  it("returns true for truthy string values regardless of case/whitespace", () => {
    expect(isQueryFlagTrue("true")).toBe(true);
    expect(isQueryFlagTrue("True")).toBe(true);
    expect(isQueryFlagTrue("TRUE")).toBe(true);
    expect(isQueryFlagTrue(" 1 ")).toBe(true);
    expect(isQueryFlagTrue("yes")).toBe(true);
    expect(isQueryFlagTrue("YES")).toBe(true);
  });

  it("returns false for falsy or other values", () => {
    expect(isQueryFlagTrue(false)).toBe(false);
    expect(isQueryFlagTrue(0)).toBe(false);
    expect(isQueryFlagTrue("false")).toBe(false);
    expect(isQueryFlagTrue("0")).toBe(false);
    expect(isQueryFlagTrue("no")).toBe(false);
    expect(isQueryFlagTrue(null)).toBe(false);
    expect(isQueryFlagTrue(undefined)).toBe(false);
    expect(isQueryFlagTrue({})).toBe(false);
    expect(isQueryFlagTrue([])).toBe(false);
  });
});

describe("paginateArray", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("paginates correctly within bounds", () => {
    const page1 = paginateArray(items, 1, 4);
    expect(page1.items).toEqual([1, 2, 3, 4]);
    expect(page1.total).toBe(10);
    expect(page1.hasMore).toBe(true);

    const page3 = paginateArray(items, 3, 4);
    expect(page3.items).toEqual([9, 10]);
    expect(page3.hasMore).toBe(false);
  });
});

describe("dedupeTrimmedIds", () => {
  it("dedupes and trims identifiers while discarding empty strings and nullish values", () => {
    const input = [
      "id-1",
      "  id-2  ",
      "",
      "id-1",
      "id-3",
      "   ",
      null as unknown as string,
      "id-2",
    ];
    expect(dedupeTrimmedIds(input)).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("handles numbers correctly", () => {
    expect(dedupeTrimmedIds([101, 102, 101, 103])).toEqual(["101", "102", "103"]);
  });

  it("handles comma-delimited strings directly without prior array splitting", () => {
    expect(dedupeTrimmedIds("id-1, id-2,  id-1, id-3 , , ")).toEqual(["id-1", "id-2", "id-3"]);
    expect(dedupeTrimmedIds("val1;val2;val1", ";")).toEqual(["val1", "val2"]);
    expect(dedupeTrimmedIds("")).toEqual([]);
    expect(dedupeTrimmedIds("   ")).toEqual([]);
  });

  it("returns empty array for empty or falsy inputs", () => {
    expect(dedupeTrimmedIds([])).toEqual([]);
    expect(dedupeTrimmedIds(null)).toEqual([]);
    expect(dedupeTrimmedIds(undefined)).toEqual([]);
  });
});
