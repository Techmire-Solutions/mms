import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsBulkActionBar } from "./StudentsBulkActionBar";

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

const defaultProps = {
  selectedCount: 4,
  viewingDeleted: false,
  canWrite: true,
  canDelete: true,
  canWriteMessaging: true,
  canExport: true,
  selectedTargets: { waTargets: [], smsReady: [], emailReady: [] },
  studentStatusOptions: ["active", "inactive"],
  statusBadgeConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  onWhatsApp: vi.fn(),
  onSms: vi.fn(),
  onEmail: vi.fn(),
  onBulkStatusChange: vi.fn(),
  onBulkEnroll: vi.fn(),
  onBulkPrintIdCards: vi.fn(),
  onBulkExport: vi.fn(),
  onRequestBulkDelete: vi.fn(),
  onRequestBulkRestore: vi.fn(),
  onClearSelection: vi.fn(),
};

describe("StudentsBulkActionBar Component", () => {
  it("renders bulk action bar with selected count and actions", () => {
    const html = renderToStaticMarkup(<StudentsBulkActionBar {...defaultProps} />);

    expect(html).toContain("students.selectedCount:4");
    expect(html).toContain("students.bulkEnroll");
    expect(html).toContain("students.bulkPrintIdCards");
    expect(html).toContain("students.bulkExport");
  });

  it("renders restore action when viewingDeleted is true", () => {
    const html = renderToStaticMarkup(
      <StudentsBulkActionBar {...defaultProps} viewingDeleted={true} />,
    );

    expect(html).toContain("students.bulkRestore");
  });
});
