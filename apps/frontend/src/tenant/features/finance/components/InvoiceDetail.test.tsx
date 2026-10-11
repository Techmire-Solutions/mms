import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { InvoiceDetail } from "./InvoiceDetail";
import type { Invoice } from "@/lib/data/financeData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.id) return `${key}:${String(params.id)}`;
      return key;
    },
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

vi.mock("@/tenant/features/finance/hooks/useFinanceCollect", () => ({
  useFinanceCollectMutations: () => ({
    cancel: { mutate: vi.fn(), isPending: false },
    credit: { mutate: vi.fn(), isPending: false },
  }),
  useFinanceCreditNotes: () => ({
    data: [],
  }),
}));

vi.mock("@/components/ui/Drawer", () => ({
  Drawer: ({
    title,
    headerExtra,
    headerActions,
    footer,
    children,
  }: {
    title: string;
    headerExtra?: React.ReactNode;
    headerActions?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="drawer-shell">
      <h2>{title}</h2>
      <div data-testid="header-actions">{headerActions}</div>
      <div data-testid="header-extra">{headerExtra}</div>
      <div>{children}</div>
      <div data-testid="drawer-footer">{footer}</div>
    </div>
  ),
}));

const mockInvoice: Invoice = {
  id: "inv-1",
  studentId: "std-1",
  studentName: "Fatima Zahra",
  class: "Hifz 1",
  session: "2025-2026",
  baseFee: 200,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 200,
  status: "pending",
  dueDate: "2026-04-01",
  paidAmt: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} as unknown as Invoice;

describe("InvoiceDetail Component", () => {
  it("renders detail drawer with student, class, session, and fee breakdown", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <InvoiceDetail
          invoice={mockInvoice}
          onClose={vi.fn()}
          onRecord={vi.fn()}
          canWrite={true}
        />,
      );
    });

    expect(container.textContent).toContain("Fatima Zahra");
    expect(container.textContent).toContain("Hifz 1");
    expect(container.textContent).toContain("2025-2026");
    expect(container.textContent).toContain("$200");

    act(() => root.unmount());
  });

  it("allows recording a payment when invoice is active", () => {
    const onRecord = vi.fn();
    const onClose = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <InvoiceDetail
          invoice={mockInvoice}
          onClose={onClose}
          onRecord={onRecord}
          canWrite={true}
        />,
      );
    });

    const recordButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("finance.recordPayment"),
    );
    expect(recordButton).toBeDefined();

    act(() => recordButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onRecord).toHaveBeenCalledWith(mockInvoice);
    expect(onClose).toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("hides record payment and correction actions when invoice is archived and renders restore action", () => {
    const onRecord = vi.fn();
    const onRestore = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <InvoiceDetail
          invoice={{
            ...mockInvoice,
            deletedAt: "2026-03-01T00:00:00.000Z",
          }}
          onClose={vi.fn()}
          onRecord={onRecord}
          canWrite={true}
          canDelete={true}
          onRestore={onRestore}
        />,
      );
    });

    // Record payment button must NOT be present when archived
    const recordButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("finance.recordPayment"),
    );
    expect(recordButton).toBeUndefined();

    // Restore action button must be present in header actions
    const restoreButton = Array.from(container.querySelectorAll("button")).find(
      (button) =>
        button.getAttribute("aria-label")?.includes("common.restore") ||
        button.textContent?.includes("common.restore"),
    );
    expect(restoreButton).toBeDefined();

    act(() => restoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onRestore).toHaveBeenCalledWith("inv-1");

    act(() => root.unmount());
  });
});
