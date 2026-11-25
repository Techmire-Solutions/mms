import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/contracts";
import { FacultyArchivedBanner } from "./FacultyArchivedBanner";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.date) return `${key}:${params.date}`;
      return key;
    },
  }),
}));

const mockFaculty: Faculty = {
  id: "tch-arch-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-010",
  gender: "male",
  specialization: "Tajweed",
  deletedAt: "2024-06-01T12:00:00Z",
  deletionReason: "Retired",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("FacultyArchivedBanner Component", () => {
  it("renders archived banner with date and reason when faculty is deleted", () => {
    const html = renderToStaticMarkup(<FacultyArchivedBanner faculty={mockFaculty} />);

    expect(html).toContain("faculty.detail.archivedBanner");
    expect(html).toContain("Retired");
    expect(html).toContain("faculty.deletionReasonLabel");
  });

  it("returns null when faculty has no deletedAt", () => {
    const html = renderToStaticMarkup(
      <FacultyArchivedBanner faculty={{ ...mockFaculty, deletedAt: undefined }} />,
    );

    expect(html).toBe("");
  });
});
