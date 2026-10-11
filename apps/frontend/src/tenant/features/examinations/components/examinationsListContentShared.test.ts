import { describe, expect, it } from "vitest";
import { getExamMeta } from "./examinationsListContentShared";
import type { Exam } from "@/lib/data/examinationData";
import type { Enrollment } from "@/lib/data/enrollmentData";

const mockExam: Exam = {
  id: "ex-1",
  name: "Tajweed Final",
  subject: "Tajweed",
  date: "2025-01-01",
  duration: 60,
  totalMarks: 100,
  passingMarks: 50,
  classIds: ["cls-1", "cls-2"],
  status: "upcoming",
  description: "",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const mockClasses = [
  { id: "cls-1", name: "Session A - Class 1" },
  { id: "cls-2", name: "Session A - Class 2" },
  { id: "cls-3", name: "Session B - Class 3" },
];

const mockEnrollments: Enrollment[] = [
  {
    id: "enr-1",
    studentId: "std-1",
    classId: "cls-1",
    status: "confirmed",
  } as any,
  {
    id: "enr-2",
    studentId: "std-2",
    classId: "cls-2",
    status: "confirmed",
  } as any,
  {
    id: "enr-3",
    studentId: "std-3",
    classId: "cls-1",
    status: "cancelled",
  } as any,
];

describe("examinationsListContentShared Utilities", () => {
  it("computes assigned classes and active student count correctly", () => {
    const { assignedClasses, studentCount } = getExamMeta(mockExam, mockClasses, mockEnrollments);

    expect(assignedClasses).toHaveLength(2);
    expect(assignedClasses.map((c) => c.id)).toEqual(["cls-1", "cls-2"]);
    expect(studentCount).toBe(2);
  });
});
