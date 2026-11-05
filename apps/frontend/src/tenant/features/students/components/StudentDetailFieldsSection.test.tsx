import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentDetailFieldsSection, type SortedField } from "./StudentDetailFieldsSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.age != null) return `${params.age} years`;
      return key;
    },
  }),
}));

const mockStudent: Student = {
  id: "std-fields-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  dob: "2012-04-10",
  registeredDate: "2023-09-01T08:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockSortedFields: SortedField[] = [
  {
    key: "gender",
    label: "Gender",
    type: "gender",
    tab: "basic",
    enabled: true,
    order: 0,
    group: "Basic Details",
  },
  {
    key: "dob",
    label: "Date of Birth",
    type: "date",
    tab: "basic",
    enabled: true,
    order: 1,
    group: "Basic Details",
  },
  {
    key: "registeredDate",
    label: "Registered Date",
    type: "date",
    tab: "basic",
    enabled: true,
    order: 2,
    group: "Basic Details",
  },
];

describe("StudentDetailFieldsSection Component", () => {
  it("renders detail attribute rows grouped by category", () => {
    const html = renderToStaticMarkup(
      <StudentDetailFieldsSection
        student={mockStudent}
        sortedEnabledFields={mockSortedFields}
        age={12}
      />,
    );

    expect(html).toContain("Basic Details");
    expect(html).toContain("Gender");
    expect(html).toContain("Date of Birth");
    expect(html).toContain("12 years");
  });

  it("renders custom field values nested under student.customFields", () => {
    const studentWithCustom: Student = {
      ...mockStudent,
      customFields: {
        hostelRoom: "Room 101",
      },
    };
    const customFieldsConfig: SortedField[] = [
      {
        key: "hostelRoom",
        label: "Hostel Room",
        type: "text",
        tab: "extended",
        enabled: true,
        order: 0,
        group: "Hostel Information",
      },
    ];

    const html = renderToStaticMarkup(
      <StudentDetailFieldsSection
        student={studentWithCustom}
        sortedEnabledFields={customFieldsConfig}
        age={null}
      />,
    );

    expect(html).toContain("Hostel Information");
    expect(html).toContain("Hostel Room");
    expect(html).toContain("Room 101");
  });
});
