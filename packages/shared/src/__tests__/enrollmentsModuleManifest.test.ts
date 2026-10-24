import { describe, expect, it } from "vitest";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  isEnrollmentDeleted,
  filterActiveEnrollments,
  enrollmentRecordSchema,
} from "../enrollments/enrollmentsModuleManifest.js";

describe("enrollmentsModuleManifest and soft-delete helpers", () => {
  it("declares soft delete in module manifest", () => {
    expect(ENROLLMENTS_MODULE_MANIFEST.softDelete).toBeDefined();
    expect(ENROLLMENTS_MODULE_MANIFEST.softDelete?.workExcludesDeleted).toBe(true);
    expect(ENROLLMENTS_MODULE_MANIFEST.softDelete?.retentionDays).toBeNull();
  });

  it("enrollmentRecordSchema permits soft-delete and cascade metadata", () => {
    const parsed = enrollmentRecordSchema.safeParse({
      id: "e-1",
      studentId: "s-1",
      sessionId: "sess-1",
      classId: "c-1",
      enrolledDate: "2026-01-01",
      status: "confirmed",
      deletedAt: "2026-02-01T00:00:00.000Z",
      deletedBy: "u-1",
      deletionReason: "Withdrawn",
      deletedWithCascade: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("isEnrollmentDeleted identifies soft-deleted enrollments", () => {
    expect(isEnrollmentDeleted({ deletedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isEnrollmentDeleted({ deletedAt: null })).toBe(false);
    expect(isEnrollmentDeleted({})).toBe(false);
  });

  it("filterActiveEnrollments filters out archived enrollments", () => {
    const list = [
      { id: "1", studentId: "s1" },
      { id: "2", studentId: "s2", deletedAt: "2026-01-01T00:00:00.000Z" },
      { id: "3", studentId: "s3", deletedAt: null },
    ];
    expect(filterActiveEnrollments(list).map((e) => e.id)).toEqual(["1", "3"]);
  });
});
