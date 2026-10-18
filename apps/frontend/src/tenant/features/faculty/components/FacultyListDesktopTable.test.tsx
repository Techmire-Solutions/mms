import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FACULTY_COLUMN_REGISTRY, type Faculty } from "@mms/shared";
import { FacultyListDesktopTable } from "./FacultyListDesktopTable";

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
        "faculty.deletionReasonLabel": "Reason",
        "faculty.form.faculty": "faculty member",
        "faculty.table.faculty": "faculty",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockFaculty: Faculty = {
  id: "tch-101",
  contactId: "cnt-tch-101",
  name: "Sheikh Jawad",
  firstName: "Jawad",
  lastName: "Kazmi",
  gender: "male",
  employeeId: "EMP-909",
  status: "active",
  roles: ["faculty"],
  department: "Islamic Studies",
  subjects: ["Fiqh", "Hadith"],
  hireDate: "2022-09-01",
  dob: "1985-04-12",
  nationalId: "12345-6789012-3",
  address: "Najaf",
  notes: "Senior faculty member",
  deletionReason: "Relocated",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const defaultProps = {
  viewMode: "table" as const,
  faculty: [mockFaculty],
  selectedIds: ["tch-101"],
  allSelected: true,
  someSelected: false,
  showDeleted: true,
  canWrite: true,
  canDelete: true,
  hasActiveFilters: false,
  isColumnVisible: () => true,
  columnRegistry: DEFAULT_FACULTY_COLUMN_REGISTRY,
  customFieldsById: new Map(),
  statusConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  sortField: "name" as const,
  sortDir: "asc" as const,
  onSort: vi.fn(),
  onSelectAll: vi.fn(),
  onSelectOne: vi.fn(),
  onView: vi.fn(),
  onEdit: vi.fn(),
  onRequestDelete: vi.fn(),
};

describe("FacultyListDesktopTable Component", () => {
  it("renders desktop table with faculty row, avatar, employeeId, and deletion reason", () => {
    const html = renderToStaticMarkup(<FacultyListDesktopTable {...defaultProps} />);

    expect(html).toContain("Sheikh Jawad");
    expect(html).toContain("EMP-909");
    expect(html).toContain("Reason: Relocated");
    expect(html).toContain("1 selected");
    expect(html).toContain('aria-label="Select Sheikh Jawad"');
  });

  it("renders empty table footer when no faculty are present", () => {
    const html = renderToStaticMarkup(
      <FacultyListDesktopTable
        {...defaultProps}
        faculty={[]}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
      />,
    );

    expect(html).toContain("0 faculty");
    expect(html).not.toContain("0 selected");
  });

  it("renders virtualized container when faculty exceed 30 items", () => {
    const manyFaculty = Array.from({ length: 35 }, (_, index) => ({
      ...mockFaculty,
      id: `faculty-${index + 1}`,
      name: `Faculty Member ${index + 1}`,
    }));
    const html = renderToStaticMarkup(
      <FacultyListDesktopTable {...defaultProps} faculty={manyFaculty} selectedIds={[]} />,
    );

    expect(html).toContain("max-h-150 overflow-y-auto");
    expect(html).toContain("35 faculty");
  });
});
