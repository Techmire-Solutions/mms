import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENT_COLUMN_REGISTRY, type Student } from "@mms/shared";
import { StudentsListCards } from "./StudentsListCards";

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
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

const mockStudent: Student = {
  id: "std-c-1",
  contactId: "cnt-std-1",
  name: "Zainab Raza",
  gender: "female",
  grNumber: "GR-123",
  fatherName: "Ali Raza",
  motherName: "Fatima Zahra",
  phone: "+1 555-0199",
  email: "zainab@madrasa.com",
  status: "active",
  dob: "2012-04-10",
  contactRelationships: [],
  deletedAt: "2024-06-01T00:00:00Z",
  deletionReason: "Archived record",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const defaultProps = {
  paginatedStudents: [mockStudent],
  sessions: [],
  selectedIds: ["std-c-1"],
  allSelected: true,
  someSelected: false,
  viewingDeleted: true,
  canWrite: true,
  canDelete: true,
  canWriteMessaging: true,
  statusBadgeConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  isColumnVisible: (_key: string) => true,
  columnRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
  onSelectAll: vi.fn(),
  onSelectOne: vi.fn(),
  onViewStudent: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
  onOpenComposer: vi.fn(),
};

describe("StudentsListCards Component", () => {
  it("renders student cards with header, pills, metadata, and archived banner", () => {
    const html = renderToStaticMarkup(<StudentsListCards {...defaultProps} />);

    expect(html).toContain("Zainab Raza");
    expect(html).toContain("Ali Raza");
    expect(html).toContain("Fatima Zahra");
    expect(html).toContain("Archived record");
    expect(html).toContain("1 selected");
  });

  it("omits phone and email pills when column visibility is false", () => {
    const html = renderToStaticMarkup(
      <StudentsListCards
        {...defaultProps}
        isColumnVisible={(key) => key !== "phone" && key !== "email"}
      />,
    );

    expect(html).toContain("Zainab Raza");
    expect(html).not.toContain("555-0199");
    expect(html).not.toContain("zainab@madrasa.com");
  });
});
