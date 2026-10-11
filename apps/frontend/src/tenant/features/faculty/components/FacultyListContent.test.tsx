import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FACULTY_COLUMN_REGISTRY, type Faculty } from "@mms/shared";
import { FacultyListContent } from "./FacultyListContent";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "faculty.table.selectFaculty" && params?.name) {
        return `Select ${params.name}`;
      }
      if (key === "faculty.selectedCount" && params?.count != null) {
        return `${params.count} selected`;
      }
      const labels: Record<string, string> = {
        "faculty.table.selectAll": "Select All",
        "faculty.table.actions": "Actions",
        "faculty.table.emptyDash": "—",
        "faculty.tryAdjustingFilters": "Try adjusting your filters",
        "faculty.noFacultyMatchFilters": "No faculty match filters",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockFaculty: Faculty = {
  id: "tch-cnt-1",
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
  faculty: [mockFaculty],
  selectedIds: ["tch-cnt-1"],
  allSelected: true,
  someSelected: false,
  showDeleted: false,
  canWrite: true,
  canDelete: true,
  hasActiveFilters: false,
  isColumnVisible: () => true,
  columnRegistry: DEFAULT_FACULTY_COLUMN_REGISTRY,
  statusConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  sortField: "name" as const,
  sortDir: "asc" as const,
  onSort: vi.fn(),
  onSelectAll: vi.fn(),
  onSelectOne: vi.fn(),
  onView: vi.fn(),
  onEdit: vi.fn(),
  onRequestDelete: vi.fn(),
  viewMode: "table" as const,
};

describe("FacultyListContent Component", () => {
  it("renders desktop table view when viewMode is table", () => {
    const html = renderToStaticMarkup(<FacultyListContent {...defaultProps} />);

    expect(html).toContain("Ustadh Umar");
    expect(html).toContain("EMP-010");
  });

  it("renders cards view when viewMode is cards", () => {
    const html = renderToStaticMarkup(<FacultyListContent {...defaultProps} viewMode="cards" />);

    expect(html).toContain("Ustadh Umar");
  });

  it("renders empty state when faculty is empty", () => {
    const html = renderToStaticMarkup(
      <FacultyListContent {...defaultProps} faculty={[]} hasActiveFilters={true} />,
    );

    expect(html).toContain("No faculty match filters");
  });
});
