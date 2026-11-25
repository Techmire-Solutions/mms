import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceBulkActionBar } from "./AttendanceBulkActionBar";

vi.mock("@mms/fe-core/i18n", () => ({
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

describe("AttendanceBulkActionBar Component", () => {
  it("renders count and delete button when records selected", () => {
    const html = renderToStaticMarkup(
      <AttendanceBulkActionBar
        selectedCount={5}
        showDeleted={false}
        canDelete={true}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    expect(html).toContain("5 selected");
    expect(html).toContain("common.delete");
    expect(html).toContain("common.deselect");
  });

  it("renders restore button when in trash mode", () => {
    const html = renderToStaticMarkup(
      <AttendanceBulkActionBar
        selectedCount={3}
        showDeleted={true}
        canDelete={true}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.trash.restore");
  });
});
