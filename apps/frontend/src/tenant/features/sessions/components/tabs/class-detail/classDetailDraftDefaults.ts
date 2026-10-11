import type {
  Class,
  SessionClassTimetable,
  SessionClassScholarship,
  ScholarshipEligibility,
} from "@/lib/data/sessionsData";

export const EMPTY_CLASS: Class = {
  id: "",
  name: "",
  gender: "mixed",
  ageCalculationDate: "",
  minAge: 0,
  maxAge: 0,
  maxStudents: 0,
  enrolled: 0,
  enrollmentDeadline: "",
  status: "active",
  facultyId: "",
  facultyName: "",
  room: "",
  fees: [],
  schedules: [],
  budgets: [],
  discounts: [],
  timetables: [],
  refreshments: [],
  scholarships: [],
};

export function createEmptyTimetable(classId: string): SessionClassTimetable {
  return {
    id: crypto.randomUUID(),
    classId,
    date: new Date().toISOString().slice(0, 10),
    periods: [],
  };
}

export function createEmptyEligibility(): ScholarshipEligibility {
  return {
    id: crypto.randomUUID(),
    orphan: false,
    job: false,
    business: false,
    property: false,
    familyMembers: 0,
    onJobMembers: 0,
    schoolGoingSiblings: 0,
    residence: "rental",
  };
}

export function createEmptyScholarship(classId: string): SessionClassScholarship {
  return {
    id: crypto.randomUUID(),
    classId,
    percentage: 0,
    expiryDate: "",
    eligibility: createEmptyEligibility(),
  };
}
