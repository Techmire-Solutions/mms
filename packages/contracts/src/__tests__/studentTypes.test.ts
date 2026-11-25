import { describe, it, expect } from "vitest";
import {
  STUDENT_STATUS_VALUES,
  STANDARD_BLOOD_GROUPS,
  STUDENT_GUARDIAN_RELATIONSHIP_ROLES,
  resolveStudentStatuses,
  isStudentDeleted,
  filterActiveStudents,
  type Student,
  type StandardBloodGroup,
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

  describe("Standardized Enums", () => {
    it("STANDARD_BLOOD_GROUPS includes all 8 ABO/Rh blood groups", () => {
      expect(STANDARD_BLOOD_GROUPS).toEqual(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
      expect(Object.isFrozen(STANDARD_BLOOD_GROUPS) || Array.isArray(STANDARD_BLOOD_GROUPS)).toBe(
        true,
      );
    });

    it("STUDENT_GUARDIAN_RELATIONSHIP_ROLES defines canonical guardian roles", () => {
      expect(STUDENT_GUARDIAN_RELATIONSHIP_ROLES).toContain("Parent");
      expect(STUDENT_GUARDIAN_RELATIONSHIP_ROLES).toContain("Father");
      expect(STUDENT_GUARDIAN_RELATIONSHIP_ROLES).toContain("Mother");
      expect(STUDENT_GUARDIAN_RELATIONSHIP_ROLES).toContain("Guardian");
      expect(STUDENT_GUARDIAN_RELATIONSHIP_ROLES).toContain("Emergency Contact");
      expect(STUDENT_GUARDIAN_RELATIONSHIP_ROLES).toContain("Authorized Pickup");
    });
  });

  describe("Student interface contract", () => {
    it("compiles with all hydrated and core fields", () => {
      const blood: StandardBloodGroup = "O+";
      const student: Student = {
        id: "std_1",
        contactId: "c_1",
        name: "Zaid Ibn Haritha",
        avatar: "/uploads/avatar.webp",
        gender: "male",
        bloodGroup: blood,
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
      expect(student.bloodGroup).toBe("O+");

      const titleCasedStudent: Student = {
        ...student,
        gender: "Male",
      };
      expect(titleCasedStudent.gender).toBe("Male");
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
