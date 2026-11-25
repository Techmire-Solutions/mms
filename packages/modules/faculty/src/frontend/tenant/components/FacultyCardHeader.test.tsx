import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/contracts";
import { FacultyCardHeader } from "./FacultyCardHeader";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

const mockFaculty: Faculty = {
  id: "tch-card-1",
  contactId: "cnt-tch-1",
  name: "Ustadha Fatima",
  firstName: "Fatima",
  lastName: "Zahra",
  gender: "female",
  employeeId: "EMP-404",
  status: "active",
  roles: ["faculty"],
  department: "Quranic Sciences",
  subjects: ["Tajweed"],
  hireDate: "2023-01-01",
  dob: "1990-01-01",
  nationalId: "12345-1234567-1",
  address: "Qom",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("FacultyCardHeader Component", () => {
  it("renders faculty name, employee ID, and gender meta by default", () => {
    const html = renderToStaticMarkup(
      <FacultyCardHeader
        faculty={mockFaculty}
        facultyId="tch-card-1"
        isSelected={false}
        displayName="Ustadha Fatima"
        onSelectOne={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("Ustadha Fatima");
    expect(html).toContain("EMP-404");
    expect(html).toContain("Female");
    expect(html).toContain('aria-label="faculty.table.selectFaculty:Ustadha Fatima"');
  });

  it("hides employee ID and gender when isColumnVisible returns false", () => {
    const html = renderToStaticMarkup(
      <FacultyCardHeader
        faculty={mockFaculty}
        facultyId="tch-card-1"
        isSelected={false}
        displayName="Ustadha Fatima"
        isColumnVisible={() => false}
        onSelectOne={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("Ustadha Fatima");
    expect(html).not.toContain("EMP-404");
    expect(html).not.toContain("Female");
  });

  it("renders checked state when isSelected is true", () => {
    const html = renderToStaticMarkup(
      <FacultyCardHeader
        faculty={mockFaculty}
        facultyId="tch-card-1"
        isSelected={true}
        displayName="Ustadha Fatima"
        onSelectOne={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain('aria-checked="true"');
  });
});
