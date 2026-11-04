import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student, ModuleColumnRegistryEntry } from "@mms/shared";
import { renderStudentsListDesktopTableCell } from "./StudentsListDesktopTableCells";

const mockTranslate = ((key: string, params?: Record<string, string>) => {
  if (params?.name) return `${key}:${params.name}`;
  const labels: Record<string, string> = {
    "students.detail.father": "Father",
    "students.detail.mother": "Mother",
    "students.idCard.guardian": "Guardian",
    "students.deletionReasonLabel": "Reason",
    "students.detail.call": "Call",
    "students.list.actionSms": "SMS",
    "students.list.actionWhatsApp": "WhatsApp",
    "students.list.actionEmail": "Email",
  };
  return labels[key] ?? key;
}) as never;

const mockStudent: Student = {
  id: "std-100",
  contactId: "cnt-std-100",
  name: "Ali Raza",
  gender: "male",
  grNumber: "GR-99",
  fatherName: "Hassan Raza",
  motherName: "Fatima Zahra",
  phone: "+1 555-0999",
  email: "ali@madrasa.com",
  status: "active",
  deletionReason: "Graduated",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const baseOptions = {
  studentRow: mockStudent,
  studentIdStr: "std-100",
  displayName: "Ali Raza",
  emptyDash: "—",
  statusBadgeConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  isColumnVisible: () => true,
  onViewStudent: vi.fn(),
  viewingDeleted: false,
  canWriteMessaging: true,
  onOpenComposer: vi.fn(),
  t: mockTranslate,
};

const createCol = (key: string, label: string): ModuleColumnRegistryEntry => ({
  key,
  label,
  enabled: true,
  order: 0,
});

describe("renderStudentsListDesktopTableCell", () => {
  it("renders name cell with student name, father name, and mother name", () => {
    const col = createCol("name", "Name");
    const html = renderToStaticMarkup(
      <div>{renderStudentsListDesktopTableCell({ ...baseOptions, col })}</div>,
    );

    expect(html).toContain("Ali Raza");
    expect(html).toContain("Father:</span> Hassan Raza");
    expect(html).toContain("Mother:</span> Fatima Zahra");
  });

  it("renders guardian name when father and mother are omitted", () => {
    const col = createCol("name", "Name");
    const studentWithGuardian: Student = {
      ...mockStudent,
      fatherName: undefined,
      motherName: undefined,
      guardianName: "Uncle Baqir",
    };
    const html = renderToStaticMarkup(
      <div>
        {renderStudentsListDesktopTableCell({
          ...baseOptions,
          studentRow: studentWithGuardian,
          col,
        })}
      </div>,
    );

    expect(html).toContain("Guardian:</span> Uncle Baqir");
  });

  it("renders grNumber badge", () => {
    const col = createCol("grNumber", "GR Number");
    const html = renderToStaticMarkup(
      <div>{renderStudentsListDesktopTableCell({ ...baseOptions, col })}</div>,
    );

    expect(html).toContain("GR-99");
  });

  it("renders gender badge", () => {
    const col = createCol("gender", "Gender");
    const html = renderToStaticMarkup(
      <div>{renderStudentsListDesktopTableCell({ ...baseOptions, col })}</div>,
    );

    expect(html).toContain("Male");
  });

  it("renders phone action buttons", () => {
    const col = createCol("phone", "Phone");
    const html = renderToStaticMarkup(
      <div>{renderStudentsListDesktopTableCell({ ...baseOptions, col })}</div>,
    );

    expect(html).toContain("+1");
    expect(html).toContain("555-0999");
  });

  it("renders email action buttons", () => {
    const col = createCol("email", "Email");
    const html = renderToStaticMarkup(
      <div>{renderStudentsListDesktopTableCell({ ...baseOptions, col })}</div>,
    );

    expect(html).toContain("ali@madrasa.com");
  });
});
