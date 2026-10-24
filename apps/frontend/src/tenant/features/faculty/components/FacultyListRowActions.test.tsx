import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/shared";
import { FacultyListRowActions } from "./FacultyListRowActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockFaculty: Faculty = {
  id: "tch-act-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-010",
  gender: "male",
  specialization: "Tajweed",
  phone: "+1 555-0200",
  email: "umar@example.com",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("FacultyListRowActions Component", () => {
  it("renders row actions menu trigger button with accessible label", () => {
    const html = renderToStaticMarkup(
      <FacultyListRowActions
        faculty={mockFaculty}
        facultyId="tch-act-1"
        showDeleted={false}
        canWrite={true}
        canDelete={true}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.table.actions");
  });
});
