import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceRecordsConfirmDialogs } from "./AttendanceRecordsConfirmDialogs";

vi.mock("@/components/app/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="dialog">{title}</div> : null,
}));

describe("AttendanceRecordsConfirmDialogs Component", () => {
  it("renders archive dialog when pendingDeleteId is set", () => {
    const html = renderToStaticMarkup(
      <AttendanceRecordsConfirmDialogs
        pendingDeleteId="rec-1"
        onPendingDeleteChange={vi.fn()}
        onConfirmDelete={vi.fn()}
        confirmBulkOpen={false}
        onConfirmBulkOpenChange={vi.fn()}
        showDeleted={false}
        selectedIdsCount={0}
        onConfirmBulkTrash={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("attendance.confirmArchiveTitle");
  });

  it("renders bulk confirm dialog when confirmBulkOpen is true", () => {
    const html = renderToStaticMarkup(
      <AttendanceRecordsConfirmDialogs
        pendingDeleteId={null}
        onPendingDeleteChange={vi.fn()}
        onConfirmDelete={vi.fn()}
        confirmBulkOpen={true}
        onConfirmBulkOpenChange={vi.fn()}
        showDeleted={true}
        selectedIdsCount={3}
        onConfirmBulkTrash={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("attendance.trash.restore");
  });
});
