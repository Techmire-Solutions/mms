import { describe, expect, it } from "vitest";
import { sectionMergeShortfall, sectionSplitBodySchema } from "./sectionOperations.js";

describe("sectionMergeShortfall", () => {
  it("given enough free seats, should report no shortfall", () => {
    // Assert
    expect(sectionMergeShortfall(3, { capacity: 10, enrolled: 7 })).toBe(0);
  });

  it("given too few free seats or a zero capacity, should report how many are missing", () => {
    // Assert
    expect(sectionMergeShortfall(5, { capacity: 10, enrolled: 8 })).toBe(3);
    expect(sectionMergeShortfall(2, { capacity: 0, enrolled: 0 })).toBe(2);
    expect(sectionMergeShortfall(1, { capacity: 5, enrolled: 9 })).toBe(1);
  });
});

describe("sectionSplitBodySchema", () => {
  it("given no students to move or extra fields, should reject the split", () => {
    // Assert
    const body = {
      name: "C",
      capacity: 20,
      effectiveOn: "2026-03-01",
      reason: "Too many students",
    };
    expect(sectionSplitBodySchema.safeParse({ ...body, enrollmentIds: [] }).success).toBe(false);
    expect(
      sectionSplitBodySchema.safeParse({ ...body, enrollmentIds: ["e1"], room: "12" }).success,
    ).toBe(false);
    expect(sectionSplitBodySchema.safeParse({ ...body, enrollmentIds: ["e1"] }).success).toBe(true);
  });
});
