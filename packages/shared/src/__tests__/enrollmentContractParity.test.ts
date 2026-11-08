import { describe, expect, it } from "vitest";
import {
  ENROLLMENT_AUDIT_REASON_CODES,
  ENROLLMENT_DROP_REASON_CODES,
  ENROLLMENT_ERROR_CODES,
  isEnrollmentErrorCode,
  normalizeEnrollmentModulePreferences,
} from "../index.js";
import { enrollmentPreferencesResponseSchema } from "../enrollments/enrollmentSetupPreferences.js";
import {
  enrollmentsListPageResponseSchema,
  enrollmentsListQuerySchema,
} from "../enrollments/enrollmentsListQuery.js";
import { enrollmentWithdrawBodySchema } from "../enrollments/enrollmentOperations.js";

describe("enrollment contract parity", () => {
  it("preference response schema has exactly the normalized preference keys", () => {
    const normalized = normalizeEnrollmentModulePreferences({});
    expect(Object.keys(normalized).sort()).toEqual(
      Object.keys(enrollmentPreferencesResponseSchema.shape).sort(),
    );
    expect(enrollmentPreferencesResponseSchema.parse(normalized)).toEqual(normalized);
  });

  it("list page schema is the single source of the page envelope", () => {
    const page = {
      enrollments: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    };
    expect(enrollmentsListPageResponseSchema.parse(page)).toEqual(page);
    expect(enrollmentsListPageResponseSchema.safeParse({ ...page, hasMore: "no" }).success).toBe(
      false,
    );
    expect(Object.keys(enrollmentsListQuerySchema.shape)).toContain("afterId");
  });

  it("lifecycle enums are unique and exported from the shared package", () => {
    for (const list of [
      ENROLLMENT_ERROR_CODES,
      ENROLLMENT_DROP_REASON_CODES,
      ENROLLMENT_AUDIT_REASON_CODES,
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
    expect(isEnrollmentErrorCode("class_full")).toBe(true);
    expect(isEnrollmentErrorCode("not_a_code")).toBe(false);
  });

  it("withdraw accepts an optional structured drop reason and rejects unknown codes", () => {
    const base = { reason: "Family relocated" };
    expect(enrollmentWithdrawBodySchema.safeParse(base).success).toBe(true);
    expect(
      enrollmentWithdrawBodySchema.safeParse({ ...base, reasonCode: "relocation" }).success,
    ).toBe(true);
    expect(
      enrollmentWithdrawBodySchema.safeParse({ ...base, reasonCode: "not_a_reason" }).success,
    ).toBe(false);
  });
});
