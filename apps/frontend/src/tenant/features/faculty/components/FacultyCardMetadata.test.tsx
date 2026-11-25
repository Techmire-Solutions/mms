import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FACULTY_COLUMN_REGISTRY, type Faculty } from "@mms/contracts";
import { FacultyCardMetadata } from "./FacultyCardMetadata";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockFaculty: Faculty = {
  id: "tch-meta-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-010",
  gender: "male",
  specialization: "Tajweed",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("FacultyCardMetadata Component", () => {
  it("renders non-face metadata tiles for visible columns", () => {
    const html = renderToStaticMarkup(
      <FacultyCardMetadata
        faculty={mockFaculty}
        isColumnVisible={() => true}
        columnRegistry={DEFAULT_FACULTY_COLUMN_REGISTRY}
        customFieldsById={new Map()}
        statusConfig={{ active: { label: "Active", cls: "bg-success" } }}
      />,
    );

    expect(html).toContain("Active");
  });

  it("returns null when no metadata columns are visible", () => {
    const html = renderToStaticMarkup(
      <FacultyCardMetadata
        faculty={mockFaculty}
        isColumnVisible={() => false}
        columnRegistry={DEFAULT_FACULTY_COLUMN_REGISTRY}
        customFieldsById={new Map()}
        statusConfig={{}}
      />,
    );

    expect(html).toBe("");
  });
});
