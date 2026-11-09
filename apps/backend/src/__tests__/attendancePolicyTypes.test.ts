import { describe, expect, it } from "vitest";
import {
  OVERRIDABLE_CODES,
  requireOverrideReason,
  toDomainError,
} from "../attendance/use-cases/attendancePolicyTypes.js";

/** Override justification rule + the policy-error mapping shared by both write gates. */
describe("requireOverrideReason", () => {
  it("returns a trimmed justification of at least three characters", () => {
    expect(requireOverrideReason("  medical note ", ["attendance_cutoff_passed"])).toBe(
      "medical note",
    );
  });

  it("refuses an empty, whitespace-only or too-short justification", () => {
    for (const reason of [undefined, null, "", "   ", "ab"]) {
      expect(() => requireOverrideReason(reason, ["attendance_day_locked"])).toThrowError(
        /must give a reason/,
      );
    }
  });

  it("reports the ignored requirement as a 422 domain error naming the codes", () => {
    try {
      requireOverrideReason(null, ["attendance_day_locked", "attendance_cutoff_passed"]);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 422,
        type: "attendance_override_reason_required",
      });
      expect((error as Error).message).toContain("attendance_day_locked");
    }
  });
});

describe("policy primitives", () => {
  it("only allows overriding the lock and the cut-off", () => {
    expect([...OVERRIDABLE_CODES]).toEqual(["attendance_day_locked", "attendance_cutoff_passed"]);
  });

  it("maps a pure policy error onto the HTTP domain error", () => {
    expect(
      toDomainError({
        code: "attendance_note_required",
        status: 409,
        message: "A note is required",
      }),
    ).toMatchObject({ statusCode: 409, type: "attendance_note_required" });
  });
});
