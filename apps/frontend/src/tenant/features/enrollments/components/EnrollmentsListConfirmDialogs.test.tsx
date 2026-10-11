import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsListConfirmDialogs } from "./EnrollmentsListConfirmDialogs";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/ModuleTrashConfirmDialogs", () => ({
  ModuleTrashConfirmDialogs: ({
    singleDeleteTitle,
    bulkDeleteTitle,
  }: {
    singleDeleteTitle: string;
    bulkDeleteTitle: string;
  }) => (
    <div data-testid="soft-delete-dialogs">
      <span>{singleDeleteTitle}</span>
      <span>{bulkDeleteTitle}</span>
    </div>
  ),
}));

describe("EnrollmentsListConfirmDialogs Component", () => {
  it("renders soft delete confirm dialogs", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListConfirmDialogs
        pendingDeleteId="enr-1"
        onPendingDeleteChange={vi.fn()}
        onConfirmDelete={vi.fn()}
        bulkDeleteCount={3}
        bulkDeleteOpen={false}
        onBulkDeleteOpenChange={vi.fn()}
        bulkRestoreOpen={false}
        onBulkRestoreOpenChange={vi.fn()}
        onConfirmBulkDelete={vi.fn()}
        onConfirmBulkRestore={vi.fn()}
      />,
    );

    expect(html).toContain("enrollments.confirmDeleteTitle");
    expect(html).toContain("enrollments.confirmBulkDeleteTitle");
  });
});
