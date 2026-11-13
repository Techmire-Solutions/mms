import { describe, expect, it } from "vitest";
import { MAX_GRACE_MARKS } from "@mms/shared";
import {
  assertEffectiveWithinTotal,
  assertGraceWithinRange,
  effectiveMarks,
  normalizeModerationReason,
} from "../examinations/domain/moderation.js";

/**
 * Domain rules for audited grace-mark moderation (extracted from the Drizzle adapter). These were
 * only reachable through the DB suite; the boundary cases (column cap, effective total) are pinned
 * here so a change cannot silently move back into the repository.
 */

describe("normalizeModerationReason", () => {
  it("trims and accepts a real reason", () => {
    expect(normalizeModerationReason("  borderline script  ")).toBe("borderline script");
  });

  it("requires at least three characters", () => {
    expect(() => normalizeModerationReason("ab")).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(() => normalizeModerationReason("   ")).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

describe("assertGraceWithinRange", () => {
  it("accepts zero and the column ceiling", () => {
    expect(() => assertGraceWithinRange(0)).not.toThrow();
    expect(() => assertGraceWithinRange(2.5)).not.toThrow();
    expect(() => assertGraceWithinRange(MAX_GRACE_MARKS)).not.toThrow();
  });

  it("rejects negative, non-finite and above-column values", () => {
    expect(() => assertGraceWithinRange(-1)).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(() => assertGraceWithinRange(Number.NaN)).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(() => assertGraceWithinRange(MAX_GRACE_MARKS + 0.01)).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

describe("effectiveMarks / assertEffectiveWithinTotal", () => {
  it("adds grace to the raw mark", () => {
    expect(effectiveMarks(60, 2.5)).toBe(62.5);
    expect(effectiveMarks(60, 0)).toBe(60);
  });

  it("allows a score exactly at the total and rejects one above it", () => {
    expect(() => assertEffectiveWithinTotal(100, 100)).not.toThrow();
    expect(() => assertEffectiveWithinTotal(100.01, 100)).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});
