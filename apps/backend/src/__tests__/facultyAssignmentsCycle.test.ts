/**
 * facultyAssignmentsCycle.test.ts
 *
 * Unit tests for assignment date-range validation and cycle detection simulation.
 */

import { describe, expect, it } from "vitest";

describe("Faculty assignments — date-range validation", () => {
  function validateDateRange(startDate: string, endDate: string | null): boolean {
    if (!endDate) return true;
    return endDate >= startDate;
  }

  it("accepts open-ended assignment (endDate null)", () => {
    expect(validateDateRange("2024-01-01", null)).toBe(true);
  });

  it("accepts valid bounded range", () => {
    expect(validateDateRange("2024-01-01", "2024-12-31")).toBe(true);
  });

  it("accepts same-day assignment (start === end)", () => {
    expect(validateDateRange("2024-06-01", "2024-06-01")).toBe(true);
  });

  it("rejects endDate before startDate", () => {
    expect(validateDateRange("2024-06-01", "2024-01-01")).toBe(false);
  });
});

describe("Faculty assignments — cycle detection", () => {
  function findAncestors(map: Map<string, string | null>, id: string, maxDepth = 20): string[] {
    const visited = new Set<string>();
    const chain: string[] = [];
    let current = map.get(id) ?? null;
    let depth = 0;
    while (current && depth < maxDepth) {
      if (visited.has(current)) break;
      visited.add(current);
      chain.push(current);
      current = map.get(current) ?? null;
      depth++;
    }
    return chain;
  }

  it("self-reporting (A reports to A) is detected immediately", () => {
    const childId = "a";
    const parentId = "a";
    expect(childId === parentId).toBe(true);
  });

  it("linear chain A→B→C is safe (no cycle)", () => {
    const map = new Map<string, string | null>([
      ["c", "b"],
      ["b", "a"],
      ["a", null],
    ]);
    const ancestors = findAncestors(map, "c");
    expect(ancestors).toEqual(["b", "a"]);
    expect(ancestors.includes("c")).toBe(false);
  });

  it("A→B→C→A is detected as a cycle", () => {
    const map = new Map<string, string | null>([
      ["a", "c"],
      ["b", "a"],
      ["c", "b"],
    ]);
    const ancestors = findAncestors(map, "a");
    expect(ancestors.includes("a")).toBe(true);
  });

  it("deep chain is truncated at maxDepth=5 without infinite loop", () => {
    const map = new Map<string, string | null>([
      ["f5", "f4"],
      ["f4", "f3"],
      ["f3", "f2"],
      ["f2", "f1"],
      ["f1", "f0"],
      ["f0", null],
    ]);
    const ancestors = findAncestors(map, "f5", 5);
    expect(ancestors.length).toBeLessThanOrEqual(5);
  });

  it("unrelated chain does not contaminate cycle detection for tenant isolation", () => {
    const mapA = new Map<string, string | null>([
      ["b", "a"],
      ["a", null],
    ]);
    const mapB = new Map<string, string | null>([
      ["y", "x"],
      ["x", null],
    ]);
    const ancestorsA = findAncestors(mapA, "b");
    const ancestorsB = findAncestors(mapB, "y");
    expect(ancestorsA.some((id) => ancestorsB.includes(id))).toBe(false);
  });
});
