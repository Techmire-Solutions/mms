import { describe, expect, it } from "vitest";
import { DEMO_STUDENT_CONTACTS_ALL, DEMO_STUDENTS, DEMO_STUDENT_COUNT } from "./demoStudents.js";
import { DEMO_FACULTY_CONTACTS, DEMO_FACULTY, DEMO_FACULTY_COUNT } from "./demoFaculty.js";

describe("demoSeedBuilders", () => {
  it("ships at least 100 students and 30 faculty with linked contacts", () => {
    expect(DEMO_STUDENTS).toHaveLength(DEMO_STUDENT_COUNT);
    expect(DEMO_STUDENTS.length).toBeGreaterThanOrEqual(100);
    expect(DEMO_STUDENT_CONTACTS_ALL.length).toBeGreaterThanOrEqual(DEMO_STUDENT_COUNT);

    expect(DEMO_FACULTY).toHaveLength(DEMO_FACULTY_COUNT);
    expect(DEMO_FACULTY.length).toBeGreaterThanOrEqual(30);
    expect(DEMO_FACULTY_CONTACTS).toHaveLength(DEMO_FACULTY_COUNT);

    for (const student of DEMO_STUDENTS) {
      expect(typeof student.contactId).toBe("number");
      expect(student.contactId).toBeGreaterThan(0);
      expect(student.grNumber).toMatch(/^\d{4}-\d{4}$/);
    }

    for (const faculty of DEMO_FACULTY) {
      expect(typeof faculty.contactId).toBe("number");
      expect(faculty.contactId).toBeGreaterThan(0);
      expect(faculty.employeeId).toMatch(/^TCH-\d{4}$/);
    }
  });
});
