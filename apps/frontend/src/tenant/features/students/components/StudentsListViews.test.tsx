import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENT_COLUMN_REGISTRY, type Student } from "@mms/shared";
import { StudentsListViews } from "./StudentsListViews";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "students.table.selectStudent" && params?.name) {
        return `Select ${params.name}`;
      }
      if (key === "students.selectedCount" && params?.count != null) {
        return `${params.count} selected`;
      }
      const labels: Record<string, string> = {
        "students.table.selectAll": "Select All",
        "common.deselect": "Deselect All",
        "students.form.student": "Student",
        "students.table.students": "Students",
        "students.detail.father": "Father",
        "students.detail.mother": "Mother",
        "students.table.actions": "Actions",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockStudent: Student = {
  id: "std-views-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const defaultProps = {
  paginatedStudents: [mockStudent],
  sessions: [],
  selectedIds: ["std-views-1"],
  allSelected: true,
  someSelected: false,
  viewingDeleted: false,
  canWrite: true,
  canDelete: true,
  canWriteMessaging: true,
  statusBadgeConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  isColumnVisible: () => true,
  columnRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
  sortField: null,
  sortDir: "asc" as const,
  onSort: vi.fn(),
  onSelectAll: vi.fn(),
  onSelectOne: vi.fn(),
  onViewStudent: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
  onOpenComposer: vi.fn(),
  viewMode: "table" as const,
};

describe("StudentsListViews Component", () => {
  it("renders table view when viewMode is table", () => {
    const html = renderToStaticMarkup(<StudentsListViews {...defaultProps} />);

    expect(html).toContain("Zayd Harith");
  });

  it("renders cards view when viewMode is cards", () => {
    const html = renderToStaticMarkup(<StudentsListViews {...defaultProps} viewMode="cards" />);

    expect(html).toContain("Zayd Harith");
  });
});
