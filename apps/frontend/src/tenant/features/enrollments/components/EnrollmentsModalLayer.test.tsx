import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsModalLayer } from "./EnrollmentsModalLayer";

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="form-modal">
        <h2>{title}</h2>
        <div>{children}</div>
      </div>
    ) : null,
}));

vi.mock("./EnrollmentDetail", () => ({
  EnrollmentDetail: () => <div data-testid="enrollment-detail">Enrollment Detail</div>,
}));

vi.mock("./EnrollmentWizard", () => ({
  EnrollmentWizard: () => <div data-testid="enrollment-wizard">Enrollment Wizard</div>,
}));

vi.mock("./EnrollmentsListConfirmDialogs", () => ({
  EnrollmentsListConfirmDialogs: () => <div data-testid="confirm-dialogs">Confirm Dialogs</div>,
}));

describe("EnrollmentsModalLayer Component", () => {
  it("renders wizard modal and confirm dialogs", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsModalLayer
        viewing={null}
        canWrite={true}
        showDeleted={false}
        showWizard={true}
        pendingDeleteId={null}
        wizardTitle="New Enrollment"
        onCloseViewing={vi.fn()}
        onStatusChange={vi.fn()}
        onPaymentStatusChange={vi.fn()}
        onCloseWizard={vi.fn()}
        onCompleteWizard={vi.fn()}
        onPendingDeleteChange={vi.fn()}
        onConfirmDelete={vi.fn()}
        bulkDeleteCount={0}
        bulkDeleteOpen={false}
        onBulkDeleteOpenChange={vi.fn()}
        bulkRestoreOpen={false}
        onBulkRestoreOpenChange={vi.fn()}
        onConfirmBulkDelete={vi.fn()}
        onConfirmBulkRestore={vi.fn()}
      />,
    );

    expect(html).toContain("New Enrollment");
    expect(html).toContain("Enrollment Wizard");
    expect(html).toContain("Confirm Dialogs");
  });
});
