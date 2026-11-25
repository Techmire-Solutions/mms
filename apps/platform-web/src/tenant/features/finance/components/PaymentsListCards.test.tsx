import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentsListCards } from "./PaymentsListCards";
import type { PaymentsListCardsProps } from "./PaymentsListCards";
import type { Payment } from "@/lib/data/financeData";

const mockPayment: Payment = {
  id: "PAY-001",
  studentName: "Abdullah Khan",
  studentId: "std-2",
  invoiceId: "INV-001",
  amount: 2500,
  date: "2025-03-15",
  method: "cash",
  receivedBy: "Accounts Dept",
  note: "First instalment",
  deletedAt: null,
} as unknown as Payment;

const baseProps: PaymentsListCardsProps = {
  payments: [mockPayment],
  selectedIds: [],
  isColumnVisible: () => true,
  canDelete: true,
  showDeleted: false,
  methodConfig: {
    cash: { label: "Cash", tone: "success" },
  } as unknown as PaymentsListCardsProps["methodConfig"],
  formatCurrency: (n) => `PKR ${n}`,
  onTogglePayment: vi.fn(),
  onRequestDelete: vi.fn(),
  onRestore: vi.fn(),
  onToggleSelectAll: vi.fn(),
  allSelected: false,
};

describe("PaymentsListCards", () => {
  it("renders student name", () => {
    const html = renderToStaticMarkup(<PaymentsListCards {...baseProps} />);
    expect(html).toContain("Abdullah Khan");
  });

  it("renders invoice ID in subtitle when invoice column visible", () => {
    const html = renderToStaticMarkup(<PaymentsListCards {...baseProps} />);
    expect(html).toContain("INV-001");
  });

  it("hides invoice ID subtitle when invoice column hidden", () => {
    const html = renderToStaticMarkup(
      <PaymentsListCards {...baseProps} isColumnVisible={(k) => k !== "invoice"} />,
    );
    expect(html).not.toContain("INV-001");
  });

  it("renders delete button when canDelete=true and showDeleted=false", () => {
    const html = renderToStaticMarkup(<PaymentsListCards {...baseProps} />);
    // Trash2 icon or aria-label for delete
    expect(html).toContain("common.delete");
  });

  it("renders restore button when showDeleted=true", () => {
    const html = renderToStaticMarkup(<PaymentsListCards {...baseProps} showDeleted={true} />);
    expect(html).toContain("finance.trash.restore");
  });

  it("renders footer border div unconditionally even when canDelete=false", () => {
    const html = renderToStaticMarkup(<PaymentsListCards {...baseProps} canDelete={false} />);
    // EntityCard.Footer always renders its container div
    expect(html).toContain("border-t border-border");
  });

  it("renders empty list without crashing", () => {
    const html = renderToStaticMarkup(<PaymentsListCards {...baseProps} payments={[]} />);
    expect(html).toBeDefined();
  });

  it("applies selected card style when payment is selected", () => {
    const html = renderToStaticMarkup(
      <PaymentsListCards {...baseProps} selectedIds={["PAY-001"]} />,
    );
    expect(html).toContain("border-primary/50");
  });

  it("hides amount when amount column hidden", () => {
    const html = renderToStaticMarkup(
      <PaymentsListCards {...baseProps} isColumnVisible={(k) => k !== "amount"} />,
    );
    expect(html).not.toContain("PKR 2500");
  });
});
