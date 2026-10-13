import { describe, expect, it } from "vitest";
import {
  STUDENTS_MODULE_MANIFEST,
  STUDENT_CARD_TEMPLATE_OBJECT_KEY,
  studentRecordSchema,
  studentListSchema,
} from "./studentsModuleManifest.js";

describe("STUDENTS_MODULE_MANIFEST", () => {
  it("exposes the module identity and REST base path", () => {
    expect(STUDENTS_MODULE_MANIFEST.moduleId).toBe("students");
    expect(STUDENTS_MODULE_MANIFEST.restBasePath).toBe("/api/students");
    expect(STUDENT_CARD_TEMPLATE_OBJECT_KEY).toBe("mms_student_card_template");
  });

  it("defines the three tiers in order", () => {
    expect(STUDENTS_MODULE_MANIFEST.tiers).toEqual(["work", "reports", "setup"]);
  });

  it("defines read/write/delete permissions", () => {
    expect(STUDENTS_MODULE_MANIFEST.permissions.read).toBe("students.read");
    expect(STUDENTS_MODULE_MANIFEST.permissions.write).toBe("students.write");
    expect(STUDENTS_MODULE_MANIFEST.permissions.delete).toBe("students.delete");
  });

  it("uses table/cards Work directory views", () => {
    expect(STUDENTS_MODULE_MANIFEST.work.directoryViews).toEqual(["table", "cards"]);
  });

  it("configures server pagination defaults", () => {
    expect(STUDENTS_MODULE_MANIFEST.defaultPageSize).toBe(50);
    expect(STUDENTS_MODULE_MANIFEST.maxPageSize).toBe(100);
  });

  it("captures soft-delete deletion reasons", () => {
    expect(STUDENTS_MODULE_MANIFEST.softDelete.captureDeletionReason).toBe(true);
    expect(STUDENTS_MODULE_MANIFEST.softDelete.workExcludesDeleted).toBe(true);
  });

  it("orders Setup sub-tabs as preferences and card_template", () => {
    expect(STUDENTS_MODULE_MANIFEST.setupSubTabs).toEqual(["preferences", "card_template"]);
  });
});

describe("studentRecordSchema", () => {
  it("parses a full student", () => {
    const student = {
      id: "s1",
      name: "Aisha Khan",
      gender: "female",
      grNumber: "GR-2024-001",
      status: "active",
      contactId: "c1",
    };
    expect(studentRecordSchema.safeParse(student).success).toBe(true);
  });

  it("is passthrough — accepts an extra custom key", () => {
    const result = studentRecordSchema.safeParse({ id: "s1", customField: "x" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.customField).toBe("x");
  });

  it("strips client-supplied soft-delete metadata", () => {
    const result = studentRecordSchema.safeParse({
      id: "s1",
      deletedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    expect(result.success && "deletedAt" in result.data).toBe(false);
  });
});

describe("studentListSchema", () => {
  it("parses an array of student records", () => {
    const list = [
      { id: "s1", name: "Aisha" },
      { id: "s2", name: "Bilal" },
    ];
    expect(studentListSchema.safeParse(list).success).toBe(true);
  });
});
