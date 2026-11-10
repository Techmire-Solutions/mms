import { describe, expect, it } from "vitest";
import {
  studentResponseRecordSchema,
  studentListPageResponseSchema,
  studentWrappedResponseSchema,
  studentsListQuerySchema,
  studentCrudContract,
  studentOperationsContract,
  studentSoftDeleteContract,
  studentSetupContract,
  studentAggregateContract,
  studentContract,
  apiErrorResponseSchema,
} from "./index.js";

describe("studentContractShared", () => {
  describe("studentResponseRecordSchema", () => {
    it("validates and preserves hydrated guardian names and custom fields", () => {
      const validStudent = {
        id: "std-100",
        contactId: "ct-100",
        name: "Fatima Al-Zahra",
        gender: "Female",
        status: "active",
        fatherName: "Ali",
        motherName: "Khadija",
        guardianName: "Ali",
        bloodGroup: "O+",
        customFields: {
          emergencyHospital: "City General",
          allergyNotes: "Peanuts",
        },
      };

      const parsed = studentResponseRecordSchema.parse(validStudent);
      expect(parsed.id).toBe("std-100");
      expect(parsed.name).toBe("Fatima Al-Zahra");
      expect(parsed.fatherName).toBe("Ali");
      expect(parsed.motherName).toBe("Khadija");
      expect(parsed.guardianName).toBe("Ali");
      expect(parsed.bloodGroup).toBe("O+");
      expect(parsed.customFields).toEqual({
        emergencyHospital: "City General",
        allergyNotes: "Peanuts",
      });
    });

    it("requires id to be present in read responses", () => {
      const missingId = {
        name: "Student Without ID",
        status: "active",
      };

      expect(() => studentResponseRecordSchema.parse(missingId)).toThrow();
    });

    it("accepts numeric IDs as well as string IDs", () => {
      const numericId = {
        id: 42,
        name: "Numeric ID Student",
        status: "active",
      };

      const parsed = studentResponseRecordSchema.parse(numericId);
      expect(parsed.id).toBe(42);
    });

    it("validates nested response wraps", () => {
      const pageResult = studentListPageResponseSchema.parse({
        students: [
          {
            id: "std-1",
            name: "Zaid",
            status: "active",
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      });

      expect(pageResult.students).toHaveLength(1);
      expect(pageResult.students[0]?.name).toBe("Zaid");

      const wrapped = studentWrappedResponseSchema.parse({
        student: {
          id: "std-2",
          name: "Bilal",
          status: "active",
        },
      });

      expect(wrapped.student.id).toBe("std-2");
    });
  });

  describe("studentsListQuerySchema", () => {
    it("parses query parameters with optional pagination", () => {
      const parsed = studentsListQuerySchema.parse({});
      expect(parsed.page).toBeUndefined();
      expect(parsed.limit).toBeUndefined();
    });

    it("parses custom filters, coerced limits, and search query", () => {
      const parsed = studentsListQuerySchema.parse({
        page: "2",
        limit: "50",
        search: "Zaid",
        status: "active",
      });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
      expect(parsed.search).toBe("Zaid");
      expect(parsed.status).toBe("active");
    });
  });

  describe("apiErrorResponseSchema", () => {
    it("validates standard API error shapes", () => {
      const parsed = apiErrorResponseSchema.parse({
        type: "not_found",
        message: "Student record does not exist",
      });
      expect(parsed.type).toBe("not_found");
      expect(parsed.message).toBe("Student record does not exist");
    });

    it("allows additional error details in passthrough", () => {
      const parsed = apiErrorResponseSchema.parse({
        type: "validation_error",
        message: "Invalid payload",
        violations: ["invalid_field"],
        details: { field: "name", error: "Required" },
      });
      expect(parsed.violations).toEqual(["invalid_field"]);
      expect(parsed.details).toEqual({ field: "name", error: "Required" });
    });
  });

  describe("ts-rest sub-contracts and composite studentContract", () => {
    it("exports modular sub-contracts with correct endpoints", () => {
      // CRUD
      expect(studentCrudContract.list.method).toBe("GET");
      expect(studentCrudContract.list.path).toBe("/api/students");
      expect(studentCrudContract.create.method).toBe("POST");
      expect(studentCrudContract.create.path).toBe("/api/students");
      expect(studentCrudContract.get.method).toBe("GET");
      expect(studentCrudContract.get.path).toBe("/api/students/:id");
      expect(studentCrudContract.update.method).toBe("PUT");
      expect(studentCrudContract.update.path).toBe("/api/students/:id");
      expect(studentCrudContract.delete.method).toBe("DELETE");
      expect(studentCrudContract.delete.path).toBe("/api/students/:id");

      // Operations
      expect(studentOperationsContract.bulkStatus.method).toBe("POST");
      expect(studentOperationsContract.bulkStatus.path).toBe("/api/students/bulk-status");
      expect(studentOperationsContract.bulkEnroll.method).toBe("POST");
      expect(studentOperationsContract.bulkEnroll.path).toBe("/api/students/bulk-enroll");
      expect(studentOperationsContract.nextGrNumber.method).toBe("GET");
      expect(studentOperationsContract.nextGrNumber.path).toBe("/api/students/next-gr-number");
      expect(studentOperationsContract.duplicateCheck.method).toBe("POST");
      expect(studentOperationsContract.duplicateCheck.path).toBe("/api/students/duplicate-check");

      // Soft delete
      expect(studentSoftDeleteContract.restore.method).toBe("POST");
      expect(studentSoftDeleteContract.restore.path).toBe("/api/students/:id/restore");
      expect(studentSoftDeleteContract.bulkDelete.method).toBe("POST");
      expect(studentSoftDeleteContract.bulkDelete.path).toBe("/api/students/bulk-delete");
      expect(studentSoftDeleteContract.bulkRestore.method).toBe("POST");
      expect(studentSoftDeleteContract.bulkRestore.path).toBe("/api/students/bulk-restore");

      // Setup
      expect(studentSetupContract.setupAudit.method).toBe("POST");
      expect(studentSetupContract.setupAudit.path).toBe("/api/students/setup-audit");
      expect(studentSetupContract.getFieldConfig.method).toBe("GET");
      expect(studentSetupContract.getFieldConfig.path).toBe("/api/students/field-config");
      expect(studentSetupContract.updateFieldConfig.method).toBe("PUT");
      expect(studentSetupContract.updateFieldConfig.path).toBe("/api/students/field-config");
      expect(studentSetupContract.getPreferences.method).toBe("GET");
      expect(studentSetupContract.getPreferences.path).toBe("/api/students/preferences");
      expect(studentSetupContract.updatePreferences.method).toBe("PUT");
      expect(studentSetupContract.updatePreferences.path).toBe("/api/students/preferences");
      expect(studentSetupContract.getLookups.method).toBe("GET");
      expect(studentSetupContract.getLookups.path).toBe("/api/students/lookups");
      expect(studentSetupContract.updateLookupKind.method).toBe("PUT");
      expect(studentSetupContract.updateLookupKind.path).toBe("/api/students/lookups/:kind");

      // Aggregate
      expect(studentAggregateContract.resolve.method).toBe("POST");
      expect(studentAggregateContract.resolve.path).toBe("/api/students/resolve");
      expect(studentAggregateContract.linkedContactIds.method).toBe("GET");
      expect(studentAggregateContract.linkedContactIds.path).toBe(
        "/api/students/linked-contact-ids",
      );
      expect(studentAggregateContract.widgetAggregates.method).toBe("POST");
      expect(studentAggregateContract.widgetAggregates.path).toBe(
        "/api/students/widget-aggregates",
      );
    });

    it("unifies all route definitions into composite studentContract", () => {
      // CRUD
      expect(studentContract.list).toBeDefined();
      expect(studentContract.create).toBeDefined();
      expect(studentContract.get).toBeDefined();
      expect(studentContract.update).toBeDefined();
      expect(studentContract.delete).toBeDefined();

      // Operations
      expect(studentContract.bulkStatus).toBeDefined();
      expect(studentContract.bulkEnroll).toBeDefined();
      expect(studentContract.nextGrNumber).toBeDefined();
      expect(studentContract.duplicateCheck).toBeDefined();
      expect(studentContract.migrateGrNumbers).toBeDefined();

      // Soft Delete
      expect(studentContract.restore).toBeDefined();
      expect(studentContract.bulkDelete).toBeDefined();
      expect(studentContract.bulkRestore).toBeDefined();

      // Setup
      expect(studentContract.setupAudit).toBeDefined();
      expect(studentContract.getFieldConfig).toBeDefined();
      expect(studentContract.updateFieldConfig).toBeDefined();
      expect(studentContract.getPreferences).toBeDefined();
      expect(studentContract.updatePreferences).toBeDefined();
      expect(studentContract.getLookups).toBeDefined();
      expect(studentContract.updateLookupKind).toBeDefined();

      // Aggregate
      expect(studentContract.resolve).toBeDefined();
      expect(studentContract.linkedContactIds).toBeDefined();
      expect(studentContract.widgetAggregates).toBeDefined();
    });
  });
});
