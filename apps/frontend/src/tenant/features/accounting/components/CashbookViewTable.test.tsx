import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CashbookViewTable } from "./CashbookViewTable";
import type { CashbookRow } from "./cashbookViewShared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(" ")}` : key,
  }),
}));

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({
    viewMode: "table" as const,
    setViewMode: vi.fn(),
  }),
}));

const mockRows: CashbookRow[] = [
  {
    id: "tx-1",
    date: "2026-03-15",
    ref: "REF-001",
    description: "Donation received",
    lines: [],
    status: "posted",
    created_by: "u-1",
    tags: [],
    attachments: [],
    fiscal_year: "2026",
    flowType: "in",
    flowLabel: "Money In",
    flowAmount: 500,
    source_type: "manual",
    source_id: "rec-1",
  },
  {
    id: "tx-2",
    date: "2026-03-16",
    ref: "REF-002",
    description: "Office supplies",
    lines: [],
    status: "posted",
    created_by: "u-1",
    tags: [],
    attachments: [],
    fiscal_year: "2026",
    flowType: "out",
    flowLabel: "Money Out",
    flowAmount: 120,
    source_type: "payment",
    source_id: "pay-1",
  },
];

describe("CashbookViewTable", () => {
  it("renders empty state when rows array is empty", () => {
    const markup = renderToStaticMarkup(
      <CashbookViewTable rows={[]} totalIn={0} totalOut={0} formatCurrency={(val) => `$${val}`} />,
    );
    expect(markup).toContain("accounting.cashbook.noTransactions");
  });

  it("renders cards layout in cards mode", () => {
    const markup = renderToStaticMarkup(
      <CashbookViewTable
        rows={mockRows}
        totalIn={500}
        totalOut={120}
        formatCurrency={(val) => `$${val}`}
        viewMode="cards"
      />,
    );
    expect(markup).toContain("REF-001");
    expect(markup).toContain("Donation received");
    expect(markup).toContain("REF-002");
    expect(markup).toContain("Office supplies");
    expect(markup).toContain("$500");
    expect(markup).toContain("$120");
    expect(markup).not.toContain("<table");
  });

  it("renders Table with header and footer in table mode", () => {
    const markup = renderToStaticMarkup(
      <CashbookViewTable
        rows={mockRows}
        totalIn={500}
        totalOut={120}
        formatCurrency={(val) => `$${val}`}
        viewMode="table"
      />,
    );
    expect(markup).toContain("<table");
    expect(markup).toContain("REF-001");
    expect(markup).toContain("REF-002");
    expect(markup).toContain("$500");
    expect(markup).toContain("$120");
  });
});
