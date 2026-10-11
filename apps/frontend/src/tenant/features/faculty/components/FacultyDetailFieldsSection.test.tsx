import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FACULTY_SETTINGS, type Faculty } from "@mms/shared";
import { FacultyDetailFieldsSection } from "./FacultyDetailFieldsSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockFaculty: Faculty = {
  id: "fac-fields-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-010",
  gender: "male",
  specialization: "Tajweed",
  phone: "+1 555-0100",
  email: "umar@example.com",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockDetailFields = [
  {
    key: "specialization",
    label: "Specialization",
    tab: "academic",
    type: "text",
    enabled: true,
    order: 0,
    isCustom: false,
  },
];

describe("FacultyDetailFieldsSection Component", () => {
  it("renders faculty fields and contact details grouped by tabs", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailFieldsSection
        faculty={mockFaculty}
        detailFields={mockDetailFields}
        displayName="Ustadh Umar"
        settings={DEFAULT_FACULTY_SETTINGS}
      />,
    );

    expect(html).toContain("Specialization");
    expect(html).toContain("Tajweed");
    expect(html).toContain("555");
    expect(html).toContain("umar@example.com");
  });
});
