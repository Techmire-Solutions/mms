import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentCardHeader } from "@/tenant/features/students/components/StudentCardHeader";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

const mockStudent: Student = {
  id: "std-1",
  contactId: "cnt-1",
  name: "Ali Hassan",
  gender: "male",
  fatherName: "Hassan Ali",
  motherName: "Fatima Zahra",
  guardianName: "Hassan Ali",
  grNumber: "GR-101",
  status: "active",
  registeredDate: "2024-01-01",
};

describe("StudentCardHeader", () => {
  it("renders student name, father name, and mother name by default when isColumnVisible is omitted", () => {
    const html = renderToStaticMarkup(
      <StudentCardHeader
        student={mockStudent}
        isSelected={false}
        displayName="Ali Hassan"
        onSelectOne={vi.fn()}
        onViewStudent={vi.fn()}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).toContain("Hassan Ali");
    expect(html).toContain("Fatima Zahra");
    expect(html).toContain('title="Hassan Ali"');
    expect(html).toContain('title="Fatima Zahra"');
    expect(html).toContain("AH");
    expect(html).toContain('aria-label="students.table.selectStudent:Ali Hassan"');
    expect(html).toContain('aria-label="students.list.viewProfile - Ali Hassan"');
  });

  it("renders student name, father name, and mother name when column settings allow", () => {
    const html = renderToStaticMarkup(
      <StudentCardHeader
        student={mockStudent}
        isSelected={false}
        displayName="Ali Hassan"
        onSelectOne={vi.fn()}
        onViewStudent={vi.fn()}
        isColumnVisible={(key) => key === "parents" || key === "gender"}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).toContain("Hassan Ali");
    expect(html).toContain("Fatima Zahra");
  });

  it("hides parents subtitle when parents column is not visible", () => {
    const html = renderToStaticMarkup(
      <StudentCardHeader
        student={mockStudent}
        isSelected={false}
        displayName="Ali Hassan"
        onSelectOne={vi.fn()}
        onViewStudent={vi.fn()}
        isColumnVisible={(key) => key !== "parents"}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).not.toContain("Hassan Ali");
    expect(html).not.toContain("Fatima Zahra");
  });

  it("renders guardian fallback when father and mother are not present", () => {
    const studentWithGuardianOnly: Student = {
      ...mockStudent,
      fatherName: undefined,
      motherName: undefined,
      guardianName: "Uncle Tariq",
    };

    const html = renderToStaticMarkup(
      <StudentCardHeader
        student={studentWithGuardianOnly}
        isSelected={false}
        onSelectOne={vi.fn()}
        onViewStudent={vi.fn()}
      />,
    );

    expect(html).toContain("Uncle Tariq");
    expect(html).toContain("students.idCard.guardian");
    expect(html).toContain('title="Uncle Tariq"');
  });

  it("renders only father when mother is not present", () => {
    const studentWithFatherOnly: Student = {
      ...mockStudent,
      motherName: undefined,
    };

    const html = renderToStaticMarkup(
      <StudentCardHeader
        student={studentWithFatherOnly}
        isSelected={false}
        onSelectOne={vi.fn()}
        onViewStudent={vi.fn()}
      />,
    );

    expect(html).toContain("Hassan Ali");
    expect(html).not.toContain("Fatima Zahra");
  });

  it("omits subtitle when student has no parents or guardian", () => {
    const studentWithoutParents: Student = {
      ...mockStudent,
      fatherName: undefined,
      motherName: undefined,
      guardianName: undefined,
    };

    const html = renderToStaticMarkup(
      <StudentCardHeader
        student={studentWithoutParents}
        isSelected={false}
        onSelectOne={vi.fn()}
        onViewStudent={vi.fn()}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).not.toContain("students.detail.father");
    expect(html).not.toContain("students.detail.mother");
    expect(html).not.toContain("students.idCard.guardian");
  });

  it("marks checkbox as checked when isSelected is true", () => {
    const html = renderToStaticMarkup(
      <StudentCardHeader
        student={mockStudent}
        isSelected={true}
        onSelectOne={vi.fn()}
        onViewStudent={vi.fn()}
      />,
    );

    expect(html).toContain('aria-checked="true"');
  });
});
