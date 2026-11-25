import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsBulkActionBar } from "./EnrollmentsBulkActionBar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `${params.count} selected`;
      return key;
    },
  }),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    language: "en",
    dir: "ltr",
    isRtl: false,
    isLoading: false,
    t: (key: string, params?: Record<string, string | number>) =>
      params?.count ? `${params.count} selected` : key,
  }),
}));

describe("EnrollmentsBulkActionBar Component", () => {
  it("renders selected items count and action buttons", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsBulkActionBar
        selectedCount={3}
        showDeleted={false}
        canDelete={true}
        canCancel={true}
        canExport={true}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        onRequestBulkCancel={vi.fn()}
        onClearSelection={vi.fn()}
        onBulkExport={vi.fn()}
      />,
    );

    expect(html).toContain("3 selected");
    expect(html).toContain("enrollments.bulkCancel");
    expect(html).toContain("enrollments.archive");
  });
});
