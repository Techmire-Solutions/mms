import { describe, expect, it } from "vitest";
import {
  distributionRecordInsertSchema,
  isDistributionDeleted,
  filterActiveDistributions,
} from "../hasanatModuleManifest.js";
import {
  examRecordInsertSchema,
  isExamDeleted,
  filterActiveExams,
} from "../examinationsModuleManifest.js";
import {
  questionBankQuestionInsertSchema,
  isQuestionDeleted,
  filterActiveQuestions,
} from "../questionBankModuleManifest.js";
import {
  invoiceRecordInsertSchema,
  isInvoiceDeleted,
  filterActiveInvoices,
  paymentRecordInsertSchema,
  isPaymentDeleted,
  filterActivePayments,
} from "../financeModuleManifest.js";
import { isUserDeleted, filterActiveUsers, type WorkspaceUser } from "../userEntityTypes.js";
import {
  accountRecordInsertSchema,
  isAccountDeleted,
  filterActiveAccounts,
  isJournalEntryDeleted,
  filterActiveJournalEntries,
  isFiscalYearDeleted,
  filterActiveFiscalYears,
} from "../accountingModuleManifest.js";
import {
  attendanceRecordInsertSchema,
  isAttendanceRecordDeleted,
  filterActiveAttendanceRecords,
} from "../attendanceModuleManifest.js";
import { isMessageLogDeleted, filterActiveMessageLogs } from "../messagingModuleManifest.js";

describe("Soft-delete invariants across shared manifests and entity types", () => {
  describe("Hasanat distributions", () => {
    it("distributionRecordInsertSchema strictly rejects soft-delete columns", () => {
      const valid = {
        batchId: "b-1",
        denominationId: "d-1",
        recipientType: "student" as const,
        issuedDate: "2026-03-01",
      };
      expect(distributionRecordInsertSchema.safeParse(valid).success).toBe(true);

      expect(
        distributionRecordInsertSchema.safeParse({ ...valid, deletedAt: "2026-03-01T00:00:00Z" })
          .success,
      ).toBe(false);
      expect(
        distributionRecordInsertSchema.safeParse({ ...valid, deletedBy: "user-1" }).success,
      ).toBe(false);
      expect(
        distributionRecordInsertSchema.safeParse({ ...valid, deletionReason: "Error" }).success,
      ).toBe(false);
    });

    it("isDistributionDeleted and filterActiveDistributions work correctly", () => {
      expect(isDistributionDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isDistributionDeleted({ deletedAt: null })).toBe(false);
      expect(isDistributionDeleted({})).toBe(false);

      const items = [
        { id: "1" },
        { id: "2", deletedAt: "2026-03-01" },
        { id: "3", deletedAt: null },
      ];
      expect(filterActiveDistributions(items).map((x) => x.id)).toEqual(["1", "3"]);
    });
  });

  describe("Examinations exams", () => {
    it("examRecordInsertSchema strictly rejects soft-delete columns", () => {
      const valid = {
        name: "Midterm 2026",
        date: "2026-03-15",
      };
      expect(examRecordInsertSchema.safeParse(valid).success).toBe(true);

      expect(
        examRecordInsertSchema.safeParse({ ...valid, deletedAt: "2026-03-01T00:00:00Z" }).success,
      ).toBe(false);
      expect(examRecordInsertSchema.safeParse({ ...valid, deletedBy: "user-1" }).success).toBe(
        false,
      );
      expect(
        examRecordInsertSchema.safeParse({ ...valid, deletionReason: "Cancelled" }).success,
      ).toBe(false);
    });

    it("isExamDeleted and filterActiveExams work correctly", () => {
      expect(isExamDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isExamDeleted({ deletedAt: null })).toBe(false);
      expect(isExamDeleted({})).toBe(false);

      const items = [{ id: "e1" }, { id: "e2", deletedAt: "2026-03-01" }];
      expect(filterActiveExams(items).map((x) => x.id)).toEqual(["e1"]);
    });
  });

  describe("QuestionBank questions", () => {
    it("questionBankQuestionInsertSchema strictly rejects soft-delete columns", () => {
      const valid = {
        categoryIds: ["cat-1"],
        type: "short" as const,
        difficulty: "medium" as const,
        questionLanguage: "en" as const,
        text: "What is the capital?",
        answer: "City",
      };
      expect(questionBankQuestionInsertSchema.safeParse(valid).success).toBe(true);

      expect(
        questionBankQuestionInsertSchema.safeParse({ ...valid, deletedAt: "2026-03-01T00:00:00Z" })
          .success,
      ).toBe(false);
      expect(
        questionBankQuestionInsertSchema.safeParse({ ...valid, deletedBy: "user-1" }).success,
      ).toBe(false);
      expect(
        questionBankQuestionInsertSchema.safeParse({ ...valid, deletionReason: "Duplicate" })
          .success,
      ).toBe(false);
    });

    it("isQuestionDeleted and filterActiveQuestions work correctly", () => {
      expect(isQuestionDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isQuestionDeleted({ deletedAt: null })).toBe(false);
      expect(isQuestionDeleted({})).toBe(false);

      const items = [
        { id: "q1", deletedAt: null },
        { id: "q2", deletedAt: "2026-03-01" },
      ];
      expect(filterActiveQuestions(items).map((x) => x.id)).toEqual(["q1"]);
    });
  });

  describe("Finance invoices and payments", () => {
    it("invoiceRecordInsertSchema strictly rejects soft-delete columns", () => {
      const valid = {
        studentId: "st-1",
        dueDate: "2026-03-31",
        finalAmt: 100,
        status: "pending" as const,
      };
      expect(invoiceRecordInsertSchema.safeParse(valid).success).toBe(true);

      expect(
        invoiceRecordInsertSchema.safeParse({ ...valid, deletedAt: "2026-03-01T00:00:00Z" })
          .success,
      ).toBe(false);
      expect(invoiceRecordInsertSchema.safeParse({ ...valid, deletedBy: "user-1" }).success).toBe(
        false,
      );
      expect(
        invoiceRecordInsertSchema.safeParse({ ...valid, deletionReason: "Void" }).success,
      ).toBe(false);
    });

    it("isInvoiceDeleted and filterActiveInvoices work correctly", () => {
      expect(isInvoiceDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isInvoiceDeleted({ deletedAt: null })).toBe(false);
      expect(isInvoiceDeleted({})).toBe(false);

      const items = [{ id: "inv-1" }, { id: "inv-2", deletedAt: "2026-03-01" }];
      expect(filterActiveInvoices(items).map((x) => x.id)).toEqual(["inv-1"]);
    });

    it("paymentRecordInsertSchema strictly rejects soft-delete columns", () => {
      const valid = {
        invoiceId: "inv-1",
        amount: 50,
        date: "2026-03-01",
      };
      expect(paymentRecordInsertSchema.safeParse(valid).success).toBe(true);

      expect(
        paymentRecordInsertSchema.safeParse({ ...valid, deletedAt: "2026-03-01T00:00:00Z" })
          .success,
      ).toBe(false);
      expect(paymentRecordInsertSchema.safeParse({ ...valid, deletedBy: "user-1" }).success).toBe(
        false,
      );
    });

    it("isPaymentDeleted and filterActivePayments work correctly", () => {
      expect(isPaymentDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isPaymentDeleted({ deletedAt: null })).toBe(false);
      expect(isPaymentDeleted({})).toBe(false);

      const items = [
        { id: "pay-1", deletedAt: null },
        { id: "pay-2", deletedAt: "2026-03-01" },
      ];
      expect(filterActivePayments(items).map((x) => x.id)).toEqual(["pay-1"]);
    });
  });

  describe("Workspace users", () => {
    it("isUserDeleted and filterActiveUsers work correctly", () => {
      expect(isUserDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isUserDeleted({ deletedAt: null })).toBe(false);
      expect(isUserDeleted({})).toBe(false);

      const users: Partial<WorkspaceUser>[] = [
        { id: "u1", name: "Alice", deletedAt: null },
        { id: "u2", name: "Bob", deletedAt: "2026-03-01" },
        { id: "u3", name: "Charlie" },
      ];
      expect(filterActiveUsers(users as WorkspaceUser[]).map((u) => u.id)).toEqual(["u1", "u3"]);
    });
  });

  describe("Accounting accounts, journal entries, and fiscal years", () => {
    it("accountRecordInsertSchema strictly rejects soft-delete columns", () => {
      const valid = {
        code: "1010",
        name: "Petty Cash",
        type: "Asset" as const,
      };
      expect(accountRecordInsertSchema.safeParse(valid).success).toBe(true);

      expect(
        accountRecordInsertSchema.safeParse({ ...valid, deletedAt: "2026-03-01T00:00:00Z" })
          .success,
      ).toBe(false);
      expect(accountRecordInsertSchema.safeParse({ ...valid, deletedBy: "user-1" }).success).toBe(
        false,
      );
    });

    it("isAccountDeleted and filterActiveAccounts work correctly", () => {
      expect(isAccountDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isAccountDeleted({ deletedAt: null })).toBe(false);
      expect(isAccountDeleted({})).toBe(false);

      const items = [
        { id: "a1", deletedAt: null },
        { id: "a2", deletedAt: "2026-03-01" },
      ];
      expect(filterActiveAccounts(items).map((x) => x.id)).toEqual(["a1"]);
    });

    it("isJournalEntryDeleted and filterActiveJournalEntries work correctly", () => {
      expect(isJournalEntryDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isJournalEntryDeleted({ deletedAt: null })).toBe(false);
      expect(isJournalEntryDeleted({})).toBe(false);

      const items = [{ id: "je1" }, { id: "je2", deletedAt: "2026-03-01" }];
      expect(filterActiveJournalEntries(items).map((x) => x.id)).toEqual(["je1"]);
    });

    it("isFiscalYearDeleted and filterActiveFiscalYears work correctly", () => {
      expect(isFiscalYearDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isFiscalYearDeleted({ deletedAt: null })).toBe(false);
      expect(isFiscalYearDeleted({})).toBe(false);

      const items = [{ id: "fy1" }, { id: "fy2", deletedAt: "2026-03-01" }];
      expect(filterActiveFiscalYears(items).map((x) => x.id)).toEqual(["fy1"]);
    });
  });

  describe("Attendance records", () => {
    it("attendanceRecordInsertSchema strictly rejects soft-delete columns", () => {
      const valid = {
        classId: "c1",
        studentId: "s1",
        date: "2026-03-01",
      };
      expect(attendanceRecordInsertSchema.safeParse(valid).success).toBe(true);

      expect(
        attendanceRecordInsertSchema.safeParse({ ...valid, deletedAt: "2026-03-01T00:00:00Z" })
          .success,
      ).toBe(false);
      expect(
        attendanceRecordInsertSchema.safeParse({ ...valid, deletedBy: "user-1" }).success,
      ).toBe(false);
    });

    it("isAttendanceRecordDeleted and filterActiveAttendanceRecords work correctly", () => {
      expect(isAttendanceRecordDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isAttendanceRecordDeleted({ deletedAt: null })).toBe(false);
      expect(isAttendanceRecordDeleted({})).toBe(false);

      const items = [
        { id: "att1", deletedAt: null },
        { id: "att2", deletedAt: "2026-03-01" },
      ];
      expect(filterActiveAttendanceRecords(items).map((x) => x.id)).toEqual(["att1"]);
    });
  });

  describe("Messaging logs", () => {
    it("isMessageLogDeleted and filterActiveMessageLogs work correctly", () => {
      expect(isMessageLogDeleted({ deletedAt: "2026-03-01" })).toBe(true);
      expect(isMessageLogDeleted({ deletedAt: null })).toBe(false);
      expect(isMessageLogDeleted({})).toBe(false);

      const items = [{ id: "msg1" }, { id: "msg2", deletedAt: "2026-03-01" }];
      expect(filterActiveMessageLogs(items).map((x) => x.id)).toEqual(["msg1"]);
    });
  });
});
