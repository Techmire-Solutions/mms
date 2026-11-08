import { describe, expect, it } from "vitest";
import {
  withoutSoftDeleteFields,
  validateActiveForeignKeys,
  validateNewEnrollmentRules,
} from "./enrollmentAdmissionRules.js";

describe("enrollmentAdmissionRules", () => {
  describe("withoutSoftDeleteFields", () => {
    it("strips server-owned soft delete fields from payload", () => {
      const payload = {
        id: "enr_1",
        studentId: "stu_1",
        deletedAt: new Date(),
        deletedBy: "usr_1",
        deletionReason: "test",
        deletedWithCascade: true,
        restoredAt: new Date(),
        restoredBy: "usr_2",
      };
      const clean = withoutSoftDeleteFields(payload);
      expect(clean).toEqual({
        id: "enr_1",
        studentId: "stu_1",
      });
      expect(clean).not.toHaveProperty("deletedAt");
      expect(clean).not.toHaveProperty("deletedBy");
      expect(clean).not.toHaveProperty("deletionReason");
      expect(clean).not.toHaveProperty("deletedWithCascade");
      expect(clean).not.toHaveProperty("restoredAt");
      expect(clean).not.toHaveProperty("restoredBy");
    });
  });

  describe("validateActiveForeignKeys", () => {
    it("passes when student and session are active", async () => {
      await expect(
        validateActiveForeignKeys(
          "test-tenant",
          { studentId: "stu_1", sessionId: "ses_1" },
          {
            findStudentById: async () => ({ id: "stu_1" }),
            findSessionById: async () => ({ id: "ses_1" }),
          },
        ),
      ).resolves.toBeUndefined();
    });

    it("throws 400 when student is archived or missing", async () => {
      await expect(
        validateActiveForeignKeys(
          "test-tenant",
          { studentId: "stu_archived" },
          {
            findStudentById: async () => ({ id: "stu_archived", deletedAt: new Date() }),
          },
        ),
      ).rejects.toThrow("Referenced student is archived or does not exist");

      await expect(
        validateActiveForeignKeys(
          "test-tenant",
          { studentId: "stu_missing" },
          {
            findStudentById: async () => null,
          },
        ),
      ).rejects.toThrow("Referenced student is archived or does not exist");
    });

    it("throws 400 when session is archived or missing", async () => {
      await expect(
        validateActiveForeignKeys(
          "test-tenant",
          { sessionId: "ses_archived" },
          {
            findSessionById: async () => ({ id: "ses_archived", deletedAt: new Date() }),
          },
        ),
      ).rejects.toThrow("Referenced session is archived or does not exist");

      await expect(
        validateActiveForeignKeys(
          "test-tenant",
          { sessionId: "ses_missing" },
          {
            findSessionById: async () => null,
          },
        ),
      ).rejects.toThrow("Referenced session is archived or does not exist");
    });
  });

  describe("validateNewEnrollmentRules", () => {
    it("skips checks when sessionId or classId is omitted", async () => {
      await expect(
        validateNewEnrollmentRules("test-tenant", { studentId: "stu_1" }),
      ).resolves.toBeUndefined();
    });

    it("throws 409 when session is read-only (archived/completed)", async () => {
      await expect(
        validateNewEnrollmentRules(
          "test-tenant",
          { sessionId: "ses_completed", classId: "cls_1" },
          {
            findSessionById: async () => ({
              id: "ses_completed",
              status: "completed",
              classes: [{ id: "cls_1" }],
            }),
          },
        ),
      ).rejects.toThrow('This session is "completed" and no longer accepts enrollments');
    });

    it("throws 400 validation error when class is not in session", async () => {
      await expect(
        validateNewEnrollmentRules(
          "test-tenant",
          { sessionId: "ses_1", classId: "cls_foreign" },
          {
            findSessionById: async () => ({
              id: "ses_1",
              status: "active",
              classes: [{ id: "cls_other" }],
            }),
          },
        ),
      ).rejects.toThrow("Class does not belong to the selected session");
    });

    it("throws 409 when class enrollment deadline has passed", async () => {
      await expect(
        validateNewEnrollmentRules(
          "test-tenant",
          { sessionId: "ses_1", classId: "cls_expired" },
          {
            findSessionById: async () => ({
              id: "ses_1",
              status: "active",
              classes: [
                {
                  id: "cls_expired",
                  enrollmentDeadline: "2020-01-01",
                },
              ],
            }),
            findWorkspaceTimezone: async () => "UTC",
          },
        ),
      ).rejects.toThrow("Enrollment closed for this class on 2020-01-01");
    });

    it("throws 422 when student is ineligible (gender/age mismatch)", async () => {
      await expect(
        validateNewEnrollmentRules(
          "test-tenant",
          { sessionId: "ses_1", classId: "cls_female", studentId: "stu_male" },
          {
            findSessionById: async () => ({
              id: "ses_1",
              status: "active",
              startDate: "2026-01-01",
              classes: [
                {
                  id: "cls_female",
                  gender: "female",
                },
              ],
            }),
            findStudentById: async () => ({
              id: "stu_male",
              gender: "male",
              dob: "2015-01-01",
            }),
            findWorkspaceTimezone: async () => "UTC",
          },
        ),
      ).rejects.toThrow("The student is not eligible for this class");
    });
  });
});
