import { describe, expect, it } from "vitest";
import type { Student } from "@mms/contracts";
import { computeStudentsSelectionTargets } from "@/tenant/features/students/hooks/studentsSelectionTargets";

function student(partial: Partial<Student> & { id: string }): Student {
  return {
    name: "Test",
    status: "active",
    ...partial,
  } as Student;
}

describe("computeStudentsSelectionTargets", () => {
  it("returns empty buckets when nothing is selected", () => {
    const result = computeStudentsSelectionTargets({
      selectedIds: [],
      workStudents: [student({ id: "1", phone: "+923001234567", email: "a@b.com" })],
    });
    expect(result).toEqual({ waTargets: [], smsReady: [], emailReady: [] });
  });

  it("filters current-page selected rows by channel eligibility", () => {
    const withPhone = student({ id: "1", phone: "+923001234567", email: "a@b.com" });
    const emailOnly = student({ id: "2", email: "b@c.com" });
    const neither = student({ id: "3" });
    const result = computeStudentsSelectionTargets({
      selectedIds: ["1", "2", "3", "missing"],
      workStudents: [withPhone, emailOnly, neither],
    });
    expect(result.smsReady.map((row) => row.id)).toEqual(["1"]);
    expect(result.emailReady.map((row) => row.id)).toEqual(["1", "2"]);
    expect(result.waTargets.map((row) => row.id)).toEqual(["1"]);
  });
});
