import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FACULTY_SETTINGS, type FacultyMember } from "@mms/shared";
import { FacultyDetail } from "./FacultyDetail";

vi.mock("@/hooks/useStandardModuleConfig", () => {
  const config = {
    settings: DEFAULT_FACULTY_SETTINGS,
    isFieldEnabled: () => true,
  };
  return {
    useFacultyConfig: () => config,
  };
});

vi.mock("@/tenant/features/faculty/components/useFacultyDetailModel", () => {
  const model = (_faculty: FacultyMember) => ({
    statusConfig: {},
    detailFields: [],
    linkedContact: null,
    primaryPhone: "+1 555-0100",
    primaryEmail: "faculty@example.com",
    hasWhatsAppContact: false,
    hasVisibleDetailFields: false,
    assignedClasses: [],
    sessionsLoading: false,
    sessionsError: false,
  });
  return {
    useFacultyDetailModel: model,
  };
});

vi.mock("@/components/ui/Drawer", () => ({
  Drawer: ({
    title,
    subtitle,
    children,
    headerActions,
    footer,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    headerActions?: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div data-testid="detail-drawer-shell">
      <h2>{title}</h2>
      <h3>{subtitle}</h3>
      <div>{headerActions}</div>
      <div>{children}</div>
      <div>{footer}</div>
    </div>
  ),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.id) return `ID: ${params.id}`;
      return key;
    },
  }),
}));

const mockFaculty: FacultyMember = {
  id: "fac-detail-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-77",
  gender: "male",
  specialization: "Tajweed",
  notes: "Senior instructor note",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("FacultyDetail Component", () => {
  it("renders faculty detail drawer with title, Employee ID, notes, and actions", () => {
    const html = renderToStaticMarkup(
      <FacultyDetail
        faculty={mockFaculty}
        onClose={vi.fn()}
        openComposer={vi.fn()}
        canWriteMessaging={true}
        onPrintIdCard={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.detail.title");
    expect(html).toContain("ID: EMP-77");
    expect(html).toContain("Senior instructor note");
    expect(html).toContain("faculty.detail.printIdCard");
  });
});
