import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/contracts";
import { FacultyList } from "./FacultyList";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock("../hooks/useFacultyStatusConfig", () => ({
  useFacultyStatusConfig: () => ({
    active: { label: "Active", cls: "bg-success/10 text-success" },
  }),
}));

const mockFaculty: Faculty[] = [
  {
    id: "fac-1",
    contactId: "cnt-1",
    name: "Ustadh Ahmad",
    employeeId: "EMP-001",
    phone: "+1234567890",
    email: "ahmad@madrasa.com",
    gender: "male",
    status: "active",
    specialization: "Quran",
    joinDate: "2023-01-01",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
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

const baseProps = {
  faculty: mockFaculty,
  viewMode: "table" as const,
  selectedIds: [],
  onSelectOne: vi.fn(),
  onSelectAll: vi.fn(),
  onSortChange: vi.fn(),
  onView: vi.fn(),
  onEdit: vi.fn(),
  onDeleteTargetChange: vi.fn(),
  columnRegistry: mockColumnRegistry,
};

describe("FacultyList Component", () => {
  it("renders table view by default", () => {
    const html = renderToStaticMarkup(<FacultyList {...baseProps} />);

    expect(html).toContain("Ustadh Ahmad");
    expect(html).toContain("EMP-001");
  });

  it("renders cards view when viewMode is cards", () => {
    const html = renderToStaticMarkup(<FacultyList {...baseProps} viewMode="cards" />);

    expect(html).toContain("Ustadh Ahmad");
    expect(html).toContain("faculty-cards");
  });

  it("renders empty state when faculty list is empty", () => {
    const html = renderToStaticMarkup(<FacultyList {...baseProps} faculty={[]} />);

    expect(html).toContain("faculty.empty.title");
  });
});
