import { describe, it, expect } from "vitest";
import {
  STUDENT_STATUS_VALUES,
  resolveStudentStatuses,
  isStudentDeleted,
  filterActiveStudents,
  type Student,
} from "../students/studentTypes.js";

describe("studentTypes", () => {
  describe("resolveStudentStatuses", () => {
    it("returns custom non-empty status arrays", () => {
      const custom = ["enrolled", "alumni"] as const;
      expect(resolveStudentStatuses(custom)).toEqual(custom);
    });

    it("falls back to default STUDENT_STATUS_VALUES when statuses is null, undefined, or empty", () => {
      expect(resolveStudentStatuses(null)).toEqual(STUDENT_STATUS_VALUES);
      expect(resolveStudentStatuses(undefined)).toEqual(STUDENT_STATUS_VALUES);
      expect(resolveStudentStatuses([])).toEqual(STUDENT_STATUS_VALUES);
    });
  });

  describe("Student interface contract", () => {
    it("compiles with all hydrated and core fields", () => {
      const student: Student = {
        id: "std_1",
        contactId: "c_1",
        name: "Zaid Ibn Haritha",
        avatar: "/uploads/avatar.webp",
        gender: "male",
        isSyed: true,
        dob: "2010-01-01",
        phone: "+92 300 1234567",
        email: "zaid@example.com",
        city: "Madinah",
        fatherContactId: "c_2",
        fatherName: "Haritha",
        motherContactId: "c_3",
        motherName: "Suada",
        guardianContactId: null,
        guardianName: undefined,
        grNumber: "GR-100",
        status: "active",
        discountType: "scholarship",
        discountPct: 20,
      };

      expect(student.id).toBe("std_1");
      expect(student.isSyed).toBe(true);
      expect(student.gender).toBe("male");
    });
  });

  describe("soft-delete predicate helpers", () => {
    it("isStudentDeleted identifies soft-deleted students", () => {
      expect(isStudentDeleted({ deletedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
      expect(isStudentDeleted({ deletedAt: null })).toBe(false);
      expect(isStudentDeleted({})).toBe(false);
    });

    it("filterActiveStudents filters out archived students", () => {
      const records = [
        { id: "1", contactId: "c1" },
        { id: "2", contactId: "c2", deletedAt: "2026-01-01T00:00:00.000Z" },
        { id: "3", contactId: "c3", deletedAt: null },
      ];
      expect(filterActiveStudents(records).map((s) => s.id)).toEqual(["1", "3"]);
    });
  });
});
