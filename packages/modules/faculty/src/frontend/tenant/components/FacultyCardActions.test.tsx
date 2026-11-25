import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/contracts";
import { FacultyCardActions } from "./FacultyCardActions";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockFaculty: Faculty = {
  id: "tch-card-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-010",
  gender: "male",
  specialization: "Tajweed",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const defaultProps = {
  faculty: mockFaculty,
  facultyId: "tch-card-1",
  displayName: "Ustadh Umar",
  showDeleted: false,
  canWrite: true,
  canDelete: true,
  onView: vi.fn(),
  onEdit: vi.fn(),
  onRequestDelete: vi.fn(),
};

describe("FacultyCardActions Component", () => {
  it("renders view details button and overflow actions menu", () => {
    const html = renderToStaticMarkup(<FacultyCardActions {...defaultProps} />);

    expect(html).toContain("faculty.actionViewShort");
    expect(html).toContain("faculty.list.viewDetails - Ustadh Umar");
    expect(html).toContain("common.actionsFor");
  });
});
