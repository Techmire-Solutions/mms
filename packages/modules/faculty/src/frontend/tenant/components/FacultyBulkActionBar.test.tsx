import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyBulkActionBar } from "./FacultyBulkActionBar";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

const defaultProps = {
  selectedIds: ["tch-1", "tch-2"],
  selectionTargets: { waTargets: [], smsReady: [], emailReady: [] },
  showDeleted: false,
  canWrite: true,
  canDelete: true,
  canWriteMessaging: true,
  canExport: true,
  statusConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  specializationOptions: ["Tajweed", "Hadith"],
  onWhatsApp: vi.fn(),
  onSms: vi.fn(),
  onEmail: vi.fn(),
  onBulkStatusChange: vi.fn(),
  onBulkSpecializationChange: vi.fn(),
  onBulkPrintIdCards: vi.fn(),
  onBulkExport: vi.fn(),
  onRequestBulkDelete: vi.fn(),
  onRequestBulkRestore: vi.fn(),
  onClearSelection: vi.fn(),
};

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    language: "en",
    dir: "ltr",
    isRtl: false,
    isLoading: false,
    t: (key: string, params?: Record<string, string | number>) =>
      params?.count ? `${key}:${params.count}` : key,
  }),
}));

describe("FacultyBulkActionBar Component", () => {
  it("renders bulk action bar with selected count and actions", () => {
    const html = renderToStaticMarkup(<FacultyBulkActionBar {...defaultProps} />);

    expect(html).toContain("faculty.selectedCount:2");
    expect(html).toContain("faculty.bulkStatus");
    expect(html).toContain("faculty.bulkSpecialization");
    expect(html).toContain("faculty.idCard.print");
    expect(html).toContain("faculty.bulkExport");
  });

  it("renders restore action when showDeleted is true", () => {
    const html = renderToStaticMarkup(
      <FacultyBulkActionBar {...defaultProps} showDeleted={true} />,
    );

    expect(html).toContain("faculty.bulkRestore");
  });
});
