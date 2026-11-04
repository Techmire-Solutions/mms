import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { renderStudentWorkColumnValue } from "./studentWorkColumnCell";

const mockTranslate = ((key: string) => {
  if (key === "students.table.emptyDash") return "—";
  return key;
}) as never;

const mockStudent: Student = {
  id: "std-work-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  dob: "2015-08-20",
  fatherName: "Harith",
  registeredDate: "2023-09-01",
  notes: "Excellent student",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const baseOptions = {
  t: mockTranslate,
  statusBadgeConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  emptyFallback: "—",
};

describe("renderStudentWorkColumnValue", () => {
  it("renders status badge for status column", () => {
    const result = renderStudentWorkColumnValue(mockStudent, "status", baseOptions);
    const html = renderToStaticMarkup(<div>{result}</div>);

    expect(html).toContain("Active");
  });

  it("renders primary responsible adult name for parents column", () => {
    const result = renderStudentWorkColumnValue(mockStudent, "parents", baseOptions);

    expect(result).toBe("Harith");
  });

  it("renders dob cell", () => {
    const result = renderStudentWorkColumnValue(mockStudent, "dob", baseOptions);
    const html = renderToStaticMarkup(<div>{result}</div>);

    expect(html).toContain("2015");
  });

  it("renders registeredDate formatted", () => {
    const result = renderStudentWorkColumnValue(mockStudent, "registeredDate", baseOptions);

    expect(typeof result).toBe("string");
    expect(result).toContain("2023");
    expect(result).not.toBe("—");
  });

  it("renders notes", () => {
    const result = renderStudentWorkColumnValue(mockStudent, "notes", baseOptions);

    expect(result).toBe("Excellent student");
  });

  it("returns emptyFallback for unknown column or empty values", () => {
    expect(renderStudentWorkColumnValue(mockStudent, "unknown_col", baseOptions)).toBe("—");
  });

  it("renders custom field value", () => {
    const customStudent = {
      ...mockStudent,
      busNumber: "Bus 12",
    } as unknown as Student;

    const result = renderStudentWorkColumnValue(customStudent, "custom:busNumber", baseOptions);

    expect(result).toBe("Bus 12");
  });
});
