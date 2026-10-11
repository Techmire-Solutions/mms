import { describe, expect, it } from "vitest";
import {
  bulkIdsBodySchema,
  bulkStringIdsBodySchema,
  softDeleteBodySchema,
} from "../schemas/api.dto.js";
import {
  stripClientSoftDeleteFields as barrelStripClientSoftDeleteFields,
  isEntityDeleted as barrelIsEntityDeleted,
  filterActiveEntities as barrelFilterActiveEntities,
  CLIENT_SOFT_DELETE_KEYS as barrelClientSoftDeleteKeys,
  CONTACT_CLIENT_SOFT_DELETE_KEYS as barrelContactClientSoftDeleteKeys,
  softDeleteBodySchema as barrelSoftDeleteBodySchema,
  bulkIdsBodySchema as barrelBulkIdsBodySchema,
  bulkStringIdsBodySchema as barrelBulkStringIdsBodySchema,
  isQueryFlagTrue as barrelIsQueryFlagTrue,
  manifestSoftDeleteSchema as barrelManifestSoftDeleteSchema,
} from "../index.js";
import {
  CLIENT_SOFT_DELETE_KEYS,
  CONTACT_CLIENT_SOFT_DELETE_KEYS,
  filterActiveContacts,
  isContactDeleted,
  stripClientSoftDeleteFields,
  stripContactClientSoftDeleteFields,
} from "../contactSoftDelete.js";
import {
  STUDENT_CLIENT_SOFT_DELETE_KEYS,
  stripStudentClientSoftDeleteFields,
} from "../studentUtils.js";
import { filterActiveStudents, isStudentDeleted } from "../studentTypes.js";
import {
  FACULTY_CLIENT_SOFT_DELETE_KEYS,
  stripFacultyClientSoftDeleteFields,
  filterActiveFaculty,
  isFacultyDeleted,
} from "../facultyUtils.js";
import {
  SESSION_CLIENT_SOFT_DELETE_KEYS,
  stripSessionClientSoftDeleteFields,
} from "../sessionUtils.js";
import { filterActiveSessions, isSessionDeleted } from "../sessionTypes.js";
import {
  ENROLLMENT_CLIENT_SOFT_DELETE_KEYS,
  stripEnrollmentClientSoftDeleteFields,
} from "../enrollmentUtils.js";
import { filterActiveEnrollments, isEnrollmentDeleted } from "../enrollmentsModuleManifest.js";
import * as studentSoftDelete from "../studentSoftDelete.js";
import * as facultySoftDelete from "../facultySoftDelete.js";
import * as sessionSoftDelete from "../sessionSoftDelete.js";
import * as enrollmentSoftDelete from "../enrollmentSoftDelete.js";
import { filterActiveEntities, isEntityDeleted, SOFT_DELETE_KEYS } from "../softDelete.js";
import { isQueryFlagTrue } from "../paginationUtils.js";
import { manifestSoftDeleteSchema } from "../types/moduleManifest.js";
import { contactWriteSchema } from "../schemas/contacts.dto.js";
import { studentWriteSchema } from "../schemas/students.dto.js";
import { buildDynamicFacultySchema } from "../schemas/faculty.dto.js";
import { sessionCreateBodySchema, sessionUpdateBodySchema } from "../schemas/sessions.dto.js";
import { SessionInsertSchema } from "../sessionTypes.js";
import type { Contact } from "../contactTypes.js";
import { DEFAULT_FACULTY_SETTINGS } from "../facultyModuleSettings.js";
import { CONTACTS_MODULE_MANIFEST } from "../contactsModuleManifest.js";
import { STUDENTS_MODULE_MANIFEST } from "../studentsModuleManifest.js";
import { FACULTY_MODULE_MANIFEST } from "../facultyModuleManifest.js";
import { SESSIONS_MODULE_MANIFEST } from "../sessionsModuleManifest.js";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  enrollmentRecordInsertSchema,
  enrollmentRecordUpdateSchema,
} from "../enrollmentsModuleManifest.js";
import {
  FINANCE_MODULE_MANIFEST,
  invoiceRecordInsertSchema,
  paymentRecordInsertSchema,
} from "../financeModuleManifest.js";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountRecordInsertSchema,
} from "../accountingModuleManifest.js";
import {
  HASANAT_MODULE_MANIFEST,
  distributionRecordInsertSchema,
} from "../hasanatModuleManifest.js";
import { OBLIGATIONS_MODULE_MANIFEST } from "../obligationsModuleManifest.js";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examRecordInsertSchema,
} from "../examinationsModuleManifest.js";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  questionBankQuestionInsertSchema,
} from "../questionBankModuleManifest.js";
import { MESSAGING_MODULE_MANIFEST } from "../messagingModuleManifest.js";

describe("Soft-Delete DTO Validation, Write Guards & Query Coercion", () => {
  describe("1. Create and Update DTOs strip or reject client soft-delete fields", () => {
    it("contactWriteSchema strips client soft-delete fields", () => {
      const payload = {
        firstName: "Zainab",
        lastName: "Kazmi",
        deletedAt: "2026-09-10T12:00:00Z",
        deletedBy: "malicious-user",
        deletionReason: "Spoofed reason",
        restoredAt: "2026-09-10T13:00:00Z",
        restoredBy: "attacker",
        deletedWithCascade: true,
      };

      const parsed = contactWriteSchema.parse(payload) as Record<string, unknown>;
      expect(parsed.firstName).toBe("Zainab");
      expect(parsed.lastName).toBe("Kazmi");
      expect(parsed.deletedAt).toBeUndefined();
      expect(parsed.deletedBy).toBeUndefined();
      expect(parsed.deletionReason).toBeUndefined();
      expect(parsed.restoredAt).toBeUndefined();
      expect(parsed.restoredBy).toBeUndefined();
      expect(parsed.deletedWithCascade).toBeUndefined();
    });

    it("studentWriteSchema strips client soft-delete fields", () => {
      const payload = {
        name: "Ali Raza",
        studentId: "STD-123",
        contactId: "c-123",
        deletedAt: "2026-09-10T12:00:00Z",
        deletedBy: "malicious-user",
        deletionReason: "Spoofed reason",
        restoredAt: "2026-09-10T13:00:00Z",
        restoredBy: "attacker",
        deletedWithCascade: true,
      };

      const parsed = studentWriteSchema.parse(payload) as Record<string, unknown>;
      expect(parsed.name).toBe("Ali Raza");
      expect(parsed.studentId).toBe("STD-123");
      expect(parsed.contactId).toBe("c-123");
      expect(parsed.deletedAt).toBeUndefined();
      expect(parsed.deletedBy).toBeUndefined();
      expect(parsed.deletionReason).toBeUndefined();
      expect(parsed.restoredAt).toBeUndefined();
      expect(parsed.restoredBy).toBeUndefined();
      expect(parsed.deletedWithCascade).toBeUndefined();
    });

    it("buildDynamicFacultySchema strips client soft-delete fields", () => {
      const facultySchema = buildDynamicFacultySchema(
        { ...DEFAULT_FACULTY_SETTINGS },
        new Set<string>(),
        {},
      );

      const payload = {
        contactId: "c-1",
        employeeId: "EMP-001",
        specialization: "Fiqh",
        designationId: "des-1",
        deletedAt: "2026-09-10T12:00:00Z",
        deletedBy: "attacker",
        deletionReason: "Illegal archive attempt",
      };

      const parsed = facultySchema.parse(payload) as Record<string, unknown>;
      expect(parsed.contactId).toBe("c-1");
      expect(parsed.employeeId).toBe("EMP-001");
      expect(parsed.specialization).toBe("Fiqh");
      expect(parsed.deletedAt).toBeUndefined();
      expect(parsed.deletedBy).toBeUndefined();
      expect(parsed.deletionReason).toBeUndefined();
    });

    it("sessionCreateBodySchema strips client soft-delete fields", () => {
      const payload = {
        name: "Summer Session 2026",
        type: "summer",
        status: "active",
        startDate: "2026-06-01",
        endDate: "2026-08-31",
        baseFee: 1500,
        currency: "PKR",
        deletedAt: "2026-09-10T12:00:00Z",
        deletedBy: "attacker",
        deletionReason: "Unauthorized",
      };

      const parsed = sessionCreateBodySchema.parse(payload) as Record<string, unknown>;
      expect(parsed.name).toBe("Summer Session 2026");
      expect(parsed.deletedAt).toBeUndefined();
      expect(parsed.deletedBy).toBeUndefined();
      expect(parsed.deletionReason).toBeUndefined();
    });

    it("sessionUpdateBodySchema strips client soft-delete fields", () => {
      const payload = {
        name: "Winter Session 2026",
        deletedAt: "2026-09-10T12:00:00Z",
        deletedBy: "attacker",
        deletionReason: "Unauthorized",
      };

      const parsed = sessionUpdateBodySchema.parse(payload) as Record<string, unknown>;
      expect(parsed.name).toBe("Winter Session 2026");
      expect(parsed.deletedAt).toBeUndefined();
      expect(parsed.deletedBy).toBeUndefined();
      expect(parsed.deletionReason).toBeUndefined();
    });

    it("enrollmentRecordInsertSchema and enrollmentRecordUpdateSchema strictly reject soft-delete fields", () => {
      const insertPayload = {
        studentId: "std-1",
        sessionId: "ses-1",
        classId: "cls-1",
        enrolledDate: "2026-09-01",
        deletedAt: "2026-09-10T12:00:00Z",
      };
      expect(enrollmentRecordInsertSchema.safeParse(insertPayload).success).toBe(false);

      const updatePayload = {
        discountPct: 15,
        deletedAt: "2026-09-10T12:00:00Z",
        deletedBy: "malicious-actor",
        deletionReason: "Archive bypass attempt",
      };
      expect(enrollmentRecordUpdateSchema.safeParse(updatePayload).success).toBe(false);
    });

    it("SessionInsertSchema strictly rejects soft-delete columns", () => {
      const payload = {
        name: "Fall Session 2026",
        type: "regular",
        status: "active",
        startDate: "2026-09-01",
        endDate: "2026-12-31",
        baseFee: 2000,
        currency: "PKR",
        deletedAt: "2026-09-10T12:00:00Z",
      };

      const result = SessionInsertSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("strict insert schemas across financial, exam, and hasanat modules reject soft-delete columns", () => {
      expect(
        invoiceRecordInsertSchema.safeParse({
          studentId: "s-1",
          contactId: "c-1",
          issueDate: "2026-09-01",
          dueDate: "2026-09-15",
          amountTotal: 1000,
          amountPaid: 0,
          amountOutstanding: 1000,
          status: "issued",
          deletedAt: "2026-09-10T00:00:00Z",
        }).success,
      ).toBe(false);

      expect(
        paymentRecordInsertSchema.safeParse({
          invoiceId: "inv-1",
          studentId: "s-1",
          contactId: "c-1",
          amount: 500,
          paymentDate: "2026-09-02",
          method: "cash",
          deletedBy: "malicious-actor",
        }).success,
      ).toBe(false);

      expect(
        accountRecordInsertSchema.safeParse({
          code: "1010",
          name: "Main Cash Account",
          type: "asset",
          deletionReason: "Unsanctioned reason",
        }).success,
      ).toBe(false);

      expect(
        distributionRecordInsertSchema.safeParse({
          batchId: "b-1",
          denominationId: "d-1",
          recipientType: "student",
          issuedDate: "2026-03-01",
          deletedAt: "2026-09-10T00:00:00Z",
        }).success,
      ).toBe(false);

      expect(
        examRecordInsertSchema.safeParse({
          title: "Midterm 2026",
          examType: "midterm",
          sessionIds: ["s-1"],
          classIds: ["c-1"],
          totalMarks: 100,
          passingMarks: 50,
          date: "2026-10-15",
          deletedAt: "2026-09-10T00:00:00Z",
        }).success,
      ).toBe(false);

      expect(
        questionBankQuestionInsertSchema.safeParse({
          title: "Sample Question",
          text: "What is the pillar?",
          difficulty: "medium",
          status: "active",
          options: [{ id: "opt-1", text: "Option A", isCorrect: true }],
          tags: ["fiqh"],
          deletedAt: "2026-09-10T00:00:00Z",
        }).success,
      ).toBe(false);
    });
  });

  describe("2. Canonical isQueryFlagTrue coercion utility", () => {
    it("evaluates boolean true representations correctly", () => {
      expect(isQueryFlagTrue(true)).toBe(true);
      expect(isQueryFlagTrue(1)).toBe(true);
      expect(isQueryFlagTrue("true")).toBe(true);
      expect(isQueryFlagTrue("True")).toBe(true);
      expect(isQueryFlagTrue("TRUE")).toBe(true);
      expect(isQueryFlagTrue("yes")).toBe(true);
      expect(isQueryFlagTrue("YES")).toBe(true);
      expect(isQueryFlagTrue("Yes")).toBe(true);
      expect(isQueryFlagTrue(" 1 ")).toBe(true);
      expect(isQueryFlagTrue(" true ")).toBe(true);
      expect(isQueryFlagTrue(" yes ")).toBe(true);
    });

    it("evaluates all falsy representations and invalid types correctly", () => {
      expect(isQueryFlagTrue(false)).toBe(false);
      expect(isQueryFlagTrue(0)).toBe(false);
      expect(isQueryFlagTrue("false")).toBe(false);
      expect(isQueryFlagTrue("False")).toBe(false);
      expect(isQueryFlagTrue("FALSE")).toBe(false);
      expect(isQueryFlagTrue("0")).toBe(false);
      expect(isQueryFlagTrue("no")).toBe(false);
      expect(isQueryFlagTrue("NO")).toBe(false);
      expect(isQueryFlagTrue(" 0 ")).toBe(false);
      expect(isQueryFlagTrue(null)).toBe(false);
      expect(isQueryFlagTrue(undefined)).toBe(false);
      expect(isQueryFlagTrue({})).toBe(false);
      expect(isQueryFlagTrue([])).toBe(false);
      expect(isQueryFlagTrue("")).toBe(false);
      expect(isQueryFlagTrue(" ")).toBe(false);
      expect(isQueryFlagTrue("trash")).toBe(false);
      expect(isQueryFlagTrue(2)).toBe(false);
      expect(isQueryFlagTrue(-1)).toBe(false);
    });
  });

  describe("3. Bulk ID and Soft-Delete Body Schemas", () => {
    it("bulkIdsBodySchema accepts arrays with 1 to 500 items", () => {
      expect(bulkIdsBodySchema.parse({ ids: ["id-1"] })).toEqual({ ids: ["id-1"] });

      const fiveHundredIds = Array.from({ length: 500 }, (_, index) => `id-${index + 1}`);
      const parsed = bulkIdsBodySchema.parse({ ids: fiveHundredIds });
      expect(parsed.ids).toHaveLength(500);
    });

    it("bulkIdsBodySchema rejects arrays with 0 or > 500 items", () => {
      expect(() => bulkIdsBodySchema.parse({ ids: [] })).toThrow();

      const fiveHundredOneIds = Array.from({ length: 501 }, (_, index) => `id-${index + 1}`);
      expect(() => bulkIdsBodySchema.parse({ ids: fiveHundredOneIds })).toThrow();
    });

    it("bulkIdsBodySchema supports optional sanitized deletionReason up to 500 characters", () => {
      const valid = { ids: ["id-1"], deletionReason: "Duplicate entry created in error" };
      expect(bulkIdsBodySchema.parse(valid)).toEqual(valid);

      const tooLongReason = "a".repeat(501);
      expect(() =>
        bulkIdsBodySchema.parse({ ids: ["id-1"], deletionReason: tooLongReason }),
      ).toThrow();
    });

    it("bulkIdsBodySchema is strict and rejects unrecognized properties", () => {
      expect(() =>
        bulkIdsBodySchema.parse({ ids: ["id-1"], unapprovedProp: "malicious" }),
      ).toThrow();
    });

    it("bulkStringIdsBodySchema strictly enforces string IDs and 1-500 bounds", () => {
      expect(bulkStringIdsBodySchema.parse({ ids: ["uuid-1", "uuid-2"] })).toEqual({
        ids: ["uuid-1", "uuid-2"],
      });

      // Rejects numeric IDs
      expect(() => bulkStringIdsBodySchema.parse({ ids: [123] })).toThrow();

      // Rejects empty string IDs
      expect(() => bulkStringIdsBodySchema.parse({ ids: [""] })).toThrow();

      // Rejects > 500 items
      const fiveHundredOneStrings = Array.from({ length: 501 }, (_, i) => `uuid-${i}`);
      expect(() => bulkStringIdsBodySchema.parse({ ids: fiveHundredOneStrings })).toThrow();
    });

    it("softDeleteBodySchema accepts empty payload or sanitized deletionReason", () => {
      expect(softDeleteBodySchema.parse({})).toEqual({});
      expect(softDeleteBodySchema.parse({ deletionReason: "Archived per policy" })).toEqual({
        deletionReason: "Archived per policy",
      });
      expect(() => softDeleteBodySchema.parse({ deletionReason: "a".repeat(501) })).toThrow();
      expect(() =>
        softDeleteBodySchema.parse({ deletionReason: "Reason", extraKey: true }),
      ).toThrow();
    });
  });

  describe("4. Module Manifest Soft-Delete Configuration Blocks", () => {
    const manifests = [
      { name: "contacts", manifest: CONTACTS_MODULE_MANIFEST, expectedReasonCapture: true },
      { name: "students", manifest: STUDENTS_MODULE_MANIFEST, expectedReasonCapture: true },
      { name: "faculty", manifest: FACULTY_MODULE_MANIFEST, expectedReasonCapture: true },
      { name: "sessions", manifest: SESSIONS_MODULE_MANIFEST, expectedReasonCapture: true },
      { name: "enrollments", manifest: ENROLLMENTS_MODULE_MANIFEST, expectedReasonCapture: true },
      { name: "finance", manifest: FINANCE_MODULE_MANIFEST, expectedReasonCapture: false },
      { name: "accounting", manifest: ACCOUNTING_MODULE_MANIFEST, expectedReasonCapture: false },
      { name: "hasanat", manifest: HASANAT_MODULE_MANIFEST, expectedReasonCapture: false },
      { name: "obligations", manifest: OBLIGATIONS_MODULE_MANIFEST, expectedReasonCapture: false },
      {
        name: "examinations",
        manifest: EXAMINATIONS_MODULE_MANIFEST,
        expectedReasonCapture: false,
      },
      {
        name: "questionBank",
        manifest: QUESTION_BANK_MODULE_MANIFEST,
        expectedReasonCapture: false,
      },
      { name: "messaging", manifest: MESSAGING_MODULE_MANIFEST, expectedReasonCapture: false },
    ];

    it.each(manifests)(
      "manifest $name defines valid softDelete configuration",
      ({ manifest, expectedReasonCapture }) => {
        expect(manifest.softDelete).toBeDefined();
        const parsed = manifestSoftDeleteSchema.parse(manifest.softDelete);

        expect(parsed.workExcludesDeleted).toBe(true);
        expect(parsed.reportsIncludeDeleted).toBe(false);
        expect(parsed.exportsIncludeDeleted).toBe(false);
        expect(parsed.captureDeletionReason).toBe(expectedReasonCapture);
      },
    );
  });

  describe("5. Entity Predicates and Client Soft-Delete Stripping Helpers", () => {
    it("standard keys tuple matches invariant contract across all modules", () => {
      const expectedKeys = [
        "deletedAt",
        "deletedBy",
        "deletionReason",
        "restoredAt",
        "restoredBy",
        "deletedWithCascade",
      ];
      expect(SOFT_DELETE_KEYS).toEqual(expectedKeys);
      expect(CLIENT_SOFT_DELETE_KEYS).toEqual(expectedKeys);
      expect(CONTACT_CLIENT_SOFT_DELETE_KEYS).toEqual(expectedKeys);
      expect(STUDENT_CLIENT_SOFT_DELETE_KEYS).toEqual(expectedKeys);
      expect(FACULTY_CLIENT_SOFT_DELETE_KEYS).toEqual(expectedKeys);
      expect(SESSION_CLIENT_SOFT_DELETE_KEYS).toEqual(expectedKeys);
      expect(ENROLLMENT_CLIENT_SOFT_DELETE_KEYS).toEqual(expectedKeys);
    });

    it("stripClientSoftDeleteFields and module aliases remove soft-delete fields safely", () => {
      const raw = {
        name: "Record",
        deletedAt: new Date(),
        deletedBy: "admin",
        deletionReason: "archive",
        restoredAt: new Date(),
        restoredBy: "manager",
        deletedWithCascade: true,
        otherField: 123,
      };

      expect(stripClientSoftDeleteFields(raw)).toEqual({ name: "Record", otherField: 123 });
      expect(stripContactClientSoftDeleteFields(raw)).toEqual({ name: "Record", otherField: 123 });
      expect(stripStudentClientSoftDeleteFields(raw)).toEqual({ name: "Record", otherField: 123 });
      expect(stripFacultyClientSoftDeleteFields(raw)).toEqual({ name: "Record", otherField: 123 });
      expect(stripSessionClientSoftDeleteFields(raw)).toEqual({ name: "Record", otherField: 123 });
      expect(stripEnrollmentClientSoftDeleteFields(raw)).toEqual({
        name: "Record",
        otherField: 123,
      });
    });

    it("predicate helpers accurately filter active vs archived records across all entity types", () => {
      const active: { id: string; name: string; deletedAt?: string | null } = {
        id: "1",
        name: "Active",
      };
      const archived: { id: string; name: string; deletedAt?: string | null } = {
        id: "2",
        name: "Archived",
        deletedAt: "2026-09-10T00:00:00Z",
      };

      expect(isEntityDeleted(active)).toBe(false);
      expect(isEntityDeleted(archived)).toBe(true);
      expect(filterActiveEntities([active, archived])).toEqual([active]);

      const activeContact: Contact = { id: "1", name: "Active", firstName: "Active" };
      const archivedContact: Contact = {
        id: "2",
        name: "Archived",
        firstName: "Archived",
        deletedAt: "2026-09-10T00:00:00Z",
      };

      expect(isContactDeleted(activeContact)).toBe(false);
      expect(isContactDeleted(archivedContact)).toBe(true);
      expect(filterActiveContacts([activeContact, archivedContact])).toEqual([activeContact]);

      expect(isStudentDeleted(active)).toBe(false);
      expect(isStudentDeleted(archived)).toBe(true);
      expect(filterActiveStudents([active, archived])).toEqual([active]);

      expect(isFacultyDeleted(active)).toBe(false);
      expect(isFacultyDeleted(archived)).toBe(true);
      expect(filterActiveFaculty([active, archived])).toEqual([active]);

      expect(isSessionDeleted(active)).toBe(false);
      expect(isSessionDeleted(archived)).toBe(true);
      expect(filterActiveSessions([active, archived])).toEqual([active]);

      expect(isEnrollmentDeleted(active)).toBe(false);
      expect(isEnrollmentDeleted(archived)).toBe(true);
      expect(filterActiveEnrollments([active, archived])).toEqual([active]);
    });

    it("parallel soft-delete modules export complete entity suites", () => {
      const activeSample: {
        name: string;
        deletedAt?: string | null;
        extra?: number;
      } = { name: "Active" };

      const sample: {
        name: string;
        deletedAt?: string | null;
        deletedBy?: string;
        deletionReason?: string;
        restoredAt?: string;
        restoredBy?: string;
        deletedWithCascade?: boolean;
        extra?: number;
      } = {
        name: "Entity",
        deletedAt: "2026-09-10T12:00:00Z",
        deletedBy: "user",
        deletionReason: "reason",
        restoredAt: "2026-09-10T13:00:00Z",
        restoredBy: "admin",
        deletedWithCascade: true,
        extra: 42,
      };

      expect(studentSoftDelete.STUDENT_CLIENT_SOFT_DELETE_KEYS).toBeDefined();
      expect(studentSoftDelete.stripStudentClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(studentSoftDelete.stripClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(studentSoftDelete.isEntityDeleted(sample)).toBe(true);
      expect(studentSoftDelete.isStudentDeleted(sample)).toBe(true);
      expect(studentSoftDelete.filterActiveEntities([activeSample, sample])).toEqual([
        activeSample,
      ]);
      expect(studentSoftDelete.filterActiveStudents([activeSample, sample])).toEqual([
        activeSample,
      ]);

      expect(facultySoftDelete.FACULTY_CLIENT_SOFT_DELETE_KEYS).toBeDefined();
      expect(facultySoftDelete.stripFacultyClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(facultySoftDelete.stripClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(facultySoftDelete.isEntityDeleted(sample)).toBe(true);
      expect(facultySoftDelete.isFacultyDeleted(sample)).toBe(true);
      expect(facultySoftDelete.filterActiveEntities([activeSample, sample])).toEqual([
        activeSample,
      ]);
      expect(facultySoftDelete.filterActiveFaculty([activeSample, sample])).toEqual([activeSample]);

      expect(sessionSoftDelete.SESSION_CLIENT_SOFT_DELETE_KEYS).toBeDefined();
      expect(sessionSoftDelete.stripSessionClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(sessionSoftDelete.stripClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(sessionSoftDelete.isEntityDeleted(sample)).toBe(true);
      expect(sessionSoftDelete.isSessionDeleted(sample)).toBe(true);
      expect(sessionSoftDelete.filterActiveEntities([activeSample, sample])).toEqual([
        activeSample,
      ]);
      expect(sessionSoftDelete.filterActiveSessions([activeSample, sample])).toEqual([
        activeSample,
      ]);

      expect(enrollmentSoftDelete.ENROLLMENT_CLIENT_SOFT_DELETE_KEYS).toBeDefined();
      expect(enrollmentSoftDelete.stripEnrollmentClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(enrollmentSoftDelete.stripClientSoftDeleteFields(sample)).toEqual({
        name: "Entity",
        extra: 42,
      });
      expect(enrollmentSoftDelete.isEntityDeleted(sample)).toBe(true);
      expect(enrollmentSoftDelete.isEnrollmentDeleted(sample)).toBe(true);
      expect(enrollmentSoftDelete.filterActiveEntities([activeSample, sample])).toEqual([
        activeSample,
      ]);
      expect(enrollmentSoftDelete.filterActiveEnrollments([activeSample, sample])).toEqual([
        activeSample,
      ]);
    });
  });

  describe("6. Barrel root named exports (@mms/shared)", () => {
    it("exports all soft-delete schemas, guards, helpers, and types from package root", () => {
      expect(barrelStripClientSoftDeleteFields).toBe(stripClientSoftDeleteFields);
      expect(barrelIsEntityDeleted).toBe(isEntityDeleted);
      expect(barrelFilterActiveEntities).toBe(filterActiveEntities);
      expect(barrelClientSoftDeleteKeys).toEqual(CLIENT_SOFT_DELETE_KEYS);
      expect(barrelContactClientSoftDeleteKeys).toEqual(CONTACT_CLIENT_SOFT_DELETE_KEYS);
      expect(barrelSoftDeleteBodySchema).toBe(softDeleteBodySchema);
      expect(barrelBulkIdsBodySchema).toBe(bulkIdsBodySchema);
      expect(barrelBulkStringIdsBodySchema).toBe(bulkStringIdsBodySchema);
      expect(barrelIsQueryFlagTrue).toBe(isQueryFlagTrue);
      expect(barrelManifestSoftDeleteSchema).toBe(manifestSoftDeleteSchema);
    });
  });
});
