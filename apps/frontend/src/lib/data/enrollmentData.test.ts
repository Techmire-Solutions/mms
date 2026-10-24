import { describe, expect, it } from "vitest";
import { calculateAgeFromDob, suggestClass, runFullEligibility, calcFee } from "./enrollmentData";
import type { Session } from "./sessionsData";

import type { Student } from "./studentsData";

describe("enrollmentData dynamic calculations", () => {
  describe("calculateAgeFromDob", () => {
    it("accurately computes age based on current date", () => {
      const now = new Date();
      const birthYear = now.getFullYear() - 10;
      const dobSameMonthPastDay = `${birthYear}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const age = calculateAgeFromDob(dobSameMonthPastDay);
      expect(age).toBe(10);
    });

    it("returns 0 for invalid or future birth dates", () => {
      expect(calculateAgeFromDob("")).toBe(0);
      expect(calculateAgeFromDob("invalid-date")).toBe(0);
    });
  });

  describe("suggestClass", () => {
    const mockSession: Session = {
      id: "sess-1",
      name: "Academic Year 2026",
      classes: [
        {
          id: "cls-junior",
          name: "Junior Hifz",
          ageMin: 7,
          ageMax: 11,
          gender: "any",
          capacity: 20,
          enrolled: 5,
        },
        {
          id: "cls-senior",
          name: "Senior Hifz",
          ageMin: 12,
          ageMax: 18,
          gender: "any",
          capacity: 20,
          enrolled: 10,
        },
      ],
    } as unknown as Session;

    it("suggests junior class for a 9-year old student", () => {
      const now = new Date();
      const student: Partial<Student> = {
        dob: `${now.getFullYear() - 9}-01-01`,
        gender: "male",
      };
      const suggested = suggestClass(student, mockSession);
      expect(suggested?.id).toBe("cls-junior");
    });

    it("suggests senior class for a 14-year old student", () => {
      const now = new Date();
      const student: Partial<Student> = {
        dob: `${now.getFullYear() - 14}-01-01`,
        gender: "female",
      };
      const suggested = suggestClass(student, mockSession);
      expect(suggested?.id).toBe("cls-senior");
    });

    it("matches title-cased student genders to canonical class genders", () => {
      const now = new Date();
      const session = {
        ...mockSession,
        classes: [
          { ...mockSession.classes[0]!, id: "cls-female", gender: "female" as const },
          { ...mockSession.classes[0]!, id: "cls-male", gender: "male" as const },
        ],
      };
      const student: Partial<Student> = {
        dob: `${now.getFullYear() - 9}-01-01`,
        gender: "Male" as unknown as Student["gender"],
      };

      expect(suggestClass(student, session)?.id).toBe("cls-male");
    });
  });

  describe("runFullEligibility", () => {
    it("passes a title-cased student gender for a matching class", () => {
      const targetClass = {
        id: "cls-male",
        name: "Male Class",
        ageMin: 5,
        ageMax: 18,
        gender: "male" as const,
        facultyId: "faculty-1",
        capacity: 20,
        enrolled: 5,
      };
      const session = {
        id: "sess-1",
        name: "Academic Year 2026",
        classes: [targetClass],
      } as unknown as Session;
      const student = {
        id: "student-1",
        name: "Ali",
        firstName: "Ali",
        gender: "Male",
      } as unknown as Student;

      const genderCheck = runFullEligibility(
        student,
        session,
        targetClass as unknown as never,
        [],
      ).find((check) => check.id === "gender");

      expect(genderCheck?.status).toBe("pass");
    });
  });

  describe("runFullEligibility delegates to the shared rule", () => {
    const classOf = (over: Record<string, unknown>) =>
      ({
        id: "cls-1",
        name: "Class",
        ageMin: 5,
        ageMax: 18,
        gender: "male" as const,
        facultyId: "faculty-1",
        capacity: 20,
        enrolled: 0,
        ...over,
      }) as unknown as never;
    const sessionOf = (cls: unknown) =>
      ({ id: "sess-1", name: "S", classes: [cls] }) as unknown as Session;
    const studentOf = (over: Record<string, unknown>) =>
      ({ id: "student-1", name: "Ali", firstName: "Ali", ...over }) as unknown as Student;

    it("reports a gender mismatch from the shared verdict", () => {
      const cls = classOf({});
      const check = runFullEligibility(
        studentOf({ gender: "Female" }),
        sessionOf(cls),
        cls,
        [],
      ).find((c) => c.id === "gender");
      expect(check?.status).toBe("fail");
    });

    it("uses the shared seat calculation for a full class", () => {
      const cls = classOf({ enrolled: 20 });
      const check = runFullEligibility(studentOf({ gender: "Male" }), sessionOf(cls), cls, []).find(
        (c) => c.id === "capacity",
      );
      expect(check?.status).toBe("fail");
    });

    it("flags an out-of-range age against the class bounds", () => {
      const cls = classOf({});
      const check = runFullEligibility(
        studentOf({ gender: "Male", dob: "1990-01-01" }),
        sessionOf(cls),
        cls,
        [],
      ).find((c) => c.id === "age");
      expect(check?.status).toBe("fail");
    });
  });

  describe("calcFee", () => {
    const sessionDiscounts: Parameters<typeof calcFee>[3] = [
      {
        id: "early_bird",
        name: "Early Bird",
        type: "percentage",
        value: 15,
      },
    ];

    it("uses matched session discount when available", () => {
      const student: Partial<Student> = {
        discountType: "early_bird",
      };
      const result = calcFee(1000, student, [], sessionDiscounts);
      expect(result.pct).toBe(15);
      expect(result.discountAmt).toBe(150);
      expect(result.finalFee).toBe(850);
      expect(result.label).toBe("Early Bird");
    });

    it("respects standard discount fallbacks", () => {
      const student: Partial<Student> = {
        discountType: "sibling",
      };
      const result = calcFee(1000, student, [], []);
      expect(result.pct).toBe(10);
      expect(result.discountAmt).toBe(100);
      expect(result.finalFee).toBe(900);
    });

    it("respects custom discountPct if provided on student", () => {
      const student: Partial<Student> = {
        discountType: "custom",
        discountPct: 30,
      };
      const result = calcFee(1000, student, [], []);
      expect(result.pct).toBe(30);
      expect(result.discountAmt).toBe(300);
      expect(result.finalFee).toBe(700);
    });
  });
});
