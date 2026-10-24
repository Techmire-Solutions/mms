import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/shared";
import { FacultyListCards } from "@/tenant/features/faculty/components/FacultyListCards";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

const mockFaculty: Faculty[] = [
  {
    id: "tch-1",
    contactId: "cnt-1",
    name: "Ustadh Ahmad",
    employeeId: "EMP-001",
    phone: "+1234567890",
    email: "ahmad@madrasa.com",
    gender: "male",
    status: "active",
    specialization: "Quran",
    joinDate: "2023-01-01",
  },
  {
    id: "tch-2",
    contactId: "cnt-2",
    name: "Ustadha Fatima",
    employeeId: "EMP-002",
    phone: "+1987654321",
    email: "fatima@madrasa.com",
    gender: "female",
    status: "inactive",
    specialization: "Hadith",
    joinDate: "2023-06-01",
    deletedAt: "2024-01-01T00:00:00Z",
  },
];

const mockColumnRegistry = [
  { key: "name", label: "Name", enabled: true, fixed: true, order: 0 },
  { key: "employeeId", label: "Employee ID", enabled: true, fixed: false, order: 1 },
  { key: "gender", label: "Gender", enabled: true, fixed: false, order: 2 },
  { key: "phone", label: "Phone", enabled: true, fixed: false, order: 3 },
  { key: "email", label: "Email", enabled: true, fixed: false, order: 4 },
  { key: "status", label: "Status", enabled: true, fixed: false, order: 5 },
];

describe("FacultyListCards", () => {
  it("renders faculty cards with names, employee ID, info pills, and selection count", () => {
    const html = renderToStaticMarkup(
      <FacultyListCards
        faculty={mockFaculty}
        selectedIds={["tch-1"]}
        allSelected={false}
        someSelected={true}
        showDeleted={false}
        canWrite={true}
        canDelete={true}
        isColumnVisible={() => true}
        columnRegistry={mockColumnRegistry}
        customFieldsById={new Map()}
        statusConfig={{}}
        onSelectAll={vi.fn()}
        onSelectOne={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
        onRestore={vi.fn()}
        onSms={vi.fn()}
        onWhatsApp={vi.fn()}
        onEmail={vi.fn()}
      />,
    );

    expect(html).toContain("Ustadh Ahmad");
    expect(html).toContain("EMP-001");
    expect(html).toContain("+1234567890");
    expect(html).toContain("ahmad@madrasa.com");
    expect(html).toContain("Ustadha Fatima");
    expect(html).toContain("faculty-cards");
    expect(html).toContain("faculty.selectedCount:1");
    expect(html).toContain('aria-checked="true"');
  });

  it("renders archived banner and restore button when viewing deleted faculty", () => {
    const html = renderToStaticMarkup(
      <FacultyListCards
        faculty={mockFaculty}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        showDeleted={true}
        canWrite={true}
        canDelete={true}
        isColumnVisible={() => true}
        columnRegistry={mockColumnRegistry}
        customFieldsById={new Map()}
        statusConfig={{}}
        onSelectAll={vi.fn()}
        onSelectOne={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(html).toContain("Ustadha Fatima");
  });

  it("respects isColumnVisible by hiding phone and email when disabled", () => {
    const html = renderToStaticMarkup(
      <FacultyListCards
        faculty={mockFaculty}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        showDeleted={false}
        canWrite={true}
        canDelete={true}
        isColumnVisible={(key) => key === "name" || key === "status"}
        columnRegistry={mockColumnRegistry}
        customFieldsById={new Map()}
        statusConfig={{}}
        onSelectAll={vi.fn()}
        onSelectOne={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(html).toContain("Ustadh Ahmad");
    expect(html).not.toContain("+1234567890");
    expect(html).not.toContain("ahmad@madrasa.com");
  });

  it("hides write and delete actions when permissions are disabled", () => {
    const html = renderToStaticMarkup(
      <FacultyListCards
        faculty={mockFaculty}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        showDeleted={false}
        canWrite={false}
        canDelete={false}
        isColumnVisible={() => true}
        columnRegistry={mockColumnRegistry}
        customFieldsById={new Map()}
        statusConfig={{}}
        onSelectAll={vi.fn()}
        onSelectOne={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(html).not.toContain("common.edit");
    expect(html).not.toContain("common.delete");
  });

  it("handles empty faculty array cleanly", () => {
    const html = renderToStaticMarkup(
      <FacultyListCards
        faculty={[]}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        showDeleted={false}
        canWrite={true}
        canDelete={true}
        isColumnVisible={() => true}
        columnRegistry={mockColumnRegistry}
        customFieldsById={new Map()}
        statusConfig={{}}
        onSelectAll={vi.fn()}
        onSelectOne={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(html).not.toContain("Ustadh Ahmad");
  });
});
