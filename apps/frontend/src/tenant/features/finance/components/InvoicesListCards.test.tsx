import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoicesListCards } from "./InvoicesListCards";
import type { InvoicesListCardsProps } from "./InvoicesListCards";

const baseProps: InvoicesListCardsProps = {
  viewMode: "cards" as const,
  invoices: [
    {
      id: "INV-001",
      studentName: "Fatima Zahra",
      studentId: "std-1",
      status: "pending",
      amount: 5000,
      balance: 5000,
      paidAmount: 0,
      dueDate: "2025-06-01",
      issueDate: "2025-01-01",
      description: "Term fee",
      deletedAt: null,
    } as unknown as InvoicesListCardsProps["invoices"][number],
  ],
  isColumnVisible: () => true,
  columnRegistry: [],
  canSelectInvoices: true,
  selectedIds: [],
  allVisibleSelected: false,
  someVisibleSelected: false,
  canWrite: true,
  canDelete: true,
  canWriteMessaging: false,
  showDeleted: false,
  statusConfig: {},
  formatCurrency: (n) => `PKR ${n}`,
  onView: vi.fn(),
  onRecord: vi.fn(),
  onRequestDelete: vi.fn(),
  onRestore: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onToggleSelectedInvoice: vi.fn(),
  openComposer: vi.fn(),
};

describe("InvoicesListCards", () => {
  it("renders student name and invoice id", () => {
    const html = renderToStaticMarkup(<InvoicesListCards {...baseProps} />);
    expect(html).toContain("Fatima Zahra");
    expect(html).toContain("INV-001");
  });

  it("renders select checkbox when canSelectInvoices=true", () => {
    const html = renderToStaticMarkup(<InvoicesListCards {...baseProps} />);
    // Checkbox input is present
    expect(html).toContain('type="checkbox"');
  });

  it("does not render checkbox when canSelectInvoices=false", () => {
    const html = renderToStaticMarkup(
      <InvoicesListCards {...baseProps} canSelectInvoices={false} />,
    );
    expect(html).not.toContain('type="checkbox"');
  });

  it("applies selected styles when invoice is in selectedIds", () => {
    const html = renderToStaticMarkup(
      <InvoicesListCards {...baseProps} selectedIds={["INV-001"]} />,
    );
    // EntityCard applies border-primary/50 for selected
    expect(html).toContain("border-primary/50");
  });

  it("renders empty list without crashing", () => {
    const html = renderToStaticMarkup(<InvoicesListCards {...baseProps} invoices={[]} />);
    expect(html).toBeDefined();
  });
});
