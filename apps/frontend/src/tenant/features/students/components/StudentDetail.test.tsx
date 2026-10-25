import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentDetail } from "./StudentDetail";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/tenant/features/students/hooks/useStudentDetailModel", () => ({
  useStudentDetailModel: (_student: Student) => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.gr) return `GR: ${params.gr}`;
      return key;
    },
    statusBadgeConfig: {},
    sortedEnabledFields: [],
    relationshipLinks: [],
    hydratedRelationships: [],
    studentContactProfile: null,
    age: 15,
    enrolledSessionDetails: [],
    sessionsLoading: false,
    sessionsError: false,
    primaryPhone: "+1 555-0100",
    primaryEmail: "student@example.com",
    hasWhatsAppContact: false,
    hasVisibleDetailFields: false,
    showNotesSection: true,
    siblings: [],
    allStudents: [],
  }),
}));

vi.mock("@/components/app/DetailDrawerShell", () => ({
  DetailDrawerShell: ({
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

const mockStudent: Student = {
  id: "std-detail-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-99",
  status: "active",
  notes: "Sample student note",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("StudentDetail Component", () => {
  it("renders student detail drawer with title, GR number, notes, and actions", () => {
    const html = renderToStaticMarkup(
      <StudentDetail
        student={mockStudent}
        onClose={vi.fn()}
        openComposer={vi.fn()}
        canWriteMessaging={true}
        onPrintIdCard={vi.fn()}
      />,
    );

    expect(html).toContain("students.detail.title");
    expect(html).toContain("GR: GR-99");
    expect(html).toContain("Sample student note");
    expect(html).toContain("students.detail.printIdCard");
  });
});
