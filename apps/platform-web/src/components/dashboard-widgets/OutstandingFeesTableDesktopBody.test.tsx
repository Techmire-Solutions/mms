import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OutstandingFeesTableDesktopBody } from "./OutstandingFeesTableDesktopBody";
import type { OutstandingFeeRow } from "./OutstandingFeesTableParts";

describe("OutstandingFeesTableDesktopBody", () => {
  const mockTranslate = ((key: string) => key) as unknown as never;
  const mockFormatCurrency = (amount: number) => `$${amount}`;
  const mockOpenComposer = vi.fn();

  const createMockRows = (count: number): OutstandingFeeRow[] => {
    return Array.from({ length: count }, (_, idx) => ({
      id: `inv-${idx + 1}`,
      studentId: `std-${idx + 1}`,
      student: `Student ${idx + 1}`,
      class: `Class A`,
      amount: 100 + idx,
      months: 2,
      contact: `+123456789${idx}`,
      email: `student${idx + 1}@example.com`,
      dueDate: "2026-08-01",
    }));
  };

  it("renders empty state when rows array is empty", () => {
    const html = renderToStaticMarkup(
      <OutstandingFeesTableDesktopBody
        rows={[]}
        canWriteMessaging={true}
        formatCurrency={mockFormatCurrency}
        openComposer={mockOpenComposer}
        t={mockTranslate}
      />,
    );

    expect(html).toContain("finance.report.noInvoicesMatch");
  });

  it("renders non-virtualized table rows when row count is <= 30", () => {
    const rows = createMockRows(5);
    const html = renderToStaticMarkup(
      <OutstandingFeesTableDesktopBody
        rows={rows}
        canWriteMessaging={true}
        formatCurrency={mockFormatCurrency}
        openComposer={mockOpenComposer}
        t={mockTranslate}
      />,
    );

    expect(html).toContain("Student 1");
    expect(html).toContain("Student 5");
    expect(html).not.toContain("max-h-120");
  });

  it("activates virtualization container when row count exceeds 30", () => {
    const rows = createMockRows(45);
    const html = renderToStaticMarkup(
      <OutstandingFeesTableDesktopBody
        rows={rows}
        canWriteMessaging={false}
        formatCurrency={mockFormatCurrency}
        openComposer={mockOpenComposer}
        t={mockTranslate}
      />,
    );

    expect(html).toContain("max-h-120");
    expect(html).toContain("overflow-y-auto");
  });
});
