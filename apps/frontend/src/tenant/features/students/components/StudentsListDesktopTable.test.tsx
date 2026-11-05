import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENT_COLUMN_REGISTRY, type Student } from "@mms/shared";
import { StudentsListDesktopTable } from "./StudentsListDesktopTable";

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
        "students.deletionReasonLabel": "Reason",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockStudent: Student = {
  id: "std-dt-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  fatherName: "Harith",
  motherName: "Sumayyah",
  status: "active",
  deletionReason: "Graduated",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const defaultProps = {
  paginatedStudents: [mockStudent],
  sessions: [],
  selectedIds: ["std-dt-1"],
  allSelected: true,
  someSelected: false,
  viewingDeleted: true,
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
};

describe("StudentsListDesktopTable Component", () => {
  it("renders desktop table with student name, parents, and selection count", () => {
    const html = renderToStaticMarkup(<StudentsListDesktopTable {...defaultProps} />);

    expect(html).toContain("Zayd Harith");
    expect(html).toContain("Father:</span> Harith");
    expect(html).toContain("Mother:</span> Sumayyah");
    expect(html).toContain("1 selected");
  });

  it("renders empty table footer when paginatedStudents is empty", () => {
    const html = renderToStaticMarkup(
      <StudentsListDesktopTable
        {...defaultProps}
        paginatedStudents={[]}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
      />,
    );

    expect(html).toContain("0 Students");
    expect(html).not.toContain("0 selected");
  });

  it("renders virtualized container when paginatedStudents exceed 30 items", () => {
    const manyStudents = Array.from({ length: 35 }, (_, index) => ({
      ...mockStudent,
      id: `student-${index + 1}`,
      name: `Student ${index + 1}`,
    }));
    const html = renderToStaticMarkup(
      <StudentsListDesktopTable
        {...defaultProps}
        paginatedStudents={manyStudents}
        selectedIds={[]}
      />,
    );

    expect(html).toContain("max-h-150 overflow-y-auto");
    expect(html).toContain("35 Students");
  });
});
