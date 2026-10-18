import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENT_COLUMN_REGISTRY, type Student } from "@mms/shared";
import { StudentsListContent } from "./StudentsListContent";

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

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [],
}));

const mockStudent: Student = {
  id: "std-cnt-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const defaultProps = {
  students: [mockStudent],
  onEdit: vi.fn(),
  viewMode: "table" as const,
  isColumnVisible: () => true,
  columnRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
  sortField: null,
  sortDir: "asc" as const,
  onServerSort: vi.fn(),
  selectedIds: ["std-cnt-1"],
  allSelected: true,
  someSelected: false,
  onSelectOne: vi.fn(),
  onSelectAll: vi.fn(),
  onViewStudent: vi.fn(),
  openComposer: vi.fn(),
  canWriteMessaging: true,
  onDeleteTargetChange: vi.fn(),
};

describe("StudentsListContent Component", () => {
  it("renders table view of students when viewMode is table", () => {
    const html = renderToStaticMarkup(<StudentsListContent {...defaultProps} />);

    expect(html).toContain("Zayd Harith");
    expect(html).toContain("1 selected");
  });

  it("renders cards view of students when viewMode is cards", () => {
    const html = renderToStaticMarkup(<StudentsListContent {...defaultProps} viewMode="cards" />);

    expect(html).toContain("Zayd Harith");
  });
});
