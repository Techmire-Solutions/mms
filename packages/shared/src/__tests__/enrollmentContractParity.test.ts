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
  enrollmentRecordInsertSchema,
  enrollmentRecordUpdateSchema,
} from "../enrollments/enrollmentsModuleManifest.js";
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

  it("write DTOs accept a full read record (round-trip) and strip server-owned fields", () => {
    const readRecord = {
      id: "enr-1",
      studentId: "std-1",
      studentName: "Student One",
      sessionId: "ses-1",
      sessionName: "Session One",
      classId: "cls-1",
      className: "Class One",
      sectionId: "sec-1",
      rollNo: "3",
      enrolledDate: "2026-09-01",
      startOn: "2026-09-01",
      endOn: null,
      endReason: null,
      promotedFromEnrollmentId: null,
      completionStatus: null,
      completedAt: null,
      certificateIssuedAt: null,
      baseFee: 1000,
      discountType: "none",
      discountLabel: "No Discount",
      discountPct: 0,
      discountAmt: 0,
      finalFee: 1000,
      status: "pending",
      invoiceId: null,
      paymentStatus: "none",
      notes: "",
      timeline: [],
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: null,
      restoredBy: null,
      deletedWithCascade: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };

    const insert = enrollmentRecordInsertSchema.parse(readRecord) as Record<string, unknown>;
    expect(insert.studentId).toBe("std-1");
    expect(insert.endOn).toBeUndefined();
    expect(insert.deletedAt).toBeUndefined();

    const update = enrollmentRecordUpdateSchema.parse(readRecord) as Record<string, unknown>;
    expect(update.studentId).toBe("std-1");
    expect(update.endOn).toBeUndefined();
    expect(update.completedAt).toBeUndefined();
    expect(update.deletedAt).toBeUndefined();
  });
});
