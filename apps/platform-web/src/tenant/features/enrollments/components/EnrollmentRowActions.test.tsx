import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentRowActions } from "./EnrollmentRowActions";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/ui")>();
  return {
    ...actual,

    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button data-testid="dropdown-menu-item" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

vi.mock("@mms/ui/app/ModuleRowActionsMenu", () => ({
  ModuleRowActionsMenu: ({
    viewLabel,
    extras,
  }: {
    viewLabel: string;
    extras?: React.ReactNode;
  }) => (
    <div data-testid="row-actions">
      <span>{viewLabel}</span>
      <div>{extras}</div>
    </div>
  ),
}));

vi.mock("@mms/fe-core/components/PersonMessagingRowActionsExtras", () => ({
  PersonMessagingRowActionsExtras: () => <div data-testid="messaging-extras">Messaging</div>,
}));

const mockEnrollment = {
  id: "enr-1",
  studentId: "std-1",
  studentName: "Zayd Harith",
  status: "active",
} as unknown as never;

describe("EnrollmentRowActions Component", () => {
  it("renders actions menu with cancel and messaging extras", () => {
    const html = renderToStaticMarkup(
      <EnrollmentRowActions
        enrollment={mockEnrollment}
        showDeleted={false}
        canWrite={true}
        canDelete={true}
        onView={vi.fn()}
        onCancel={vi.fn()}
        openComposer={vi.fn()}
      />,
    );

    expect(html).toContain("enrollments.table.viewProfile");
    expect(html).toContain("enrollments.actions.cancelShort");
    expect(html).toContain("Messaging");
  });
});
