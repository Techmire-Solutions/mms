import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GeneralLedgerEntries } from "./GeneralLedgerEntries";
import type { Account } from "@/lib/data/accountingData";
import type { GeneralLedgerLineWithRunning } from "../hooks/useGeneralLedger";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(" ")}` : key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({ formatCurrency: (val: number) => `$${val}` }),
}));

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({
    viewMode: "table" as const,
    setViewMode: vi.fn(),
  }),
}));

const mockAccount: Account = {
  id: "acc-1",
  code: "1000",
  name: "Main Cash Box",
  type: "Asset",
  subtype: "Cash",
  description: "Primary cash drawer",
  isActive: true,
};

const mockLines: GeneralLedgerLineWithRunning[] = [
  {
    date: "2026-03-01",
    ref: "JE-001",
    description: "Opening Balance",
    lineDesc: "Cash float",
    debit: 500,
    credit: 0,
    running: 500,
  },
  {
    date: "2026-03-05",
    ref: "JE-002",
    description: "Utility Bill Payment",
    lineDesc: "Electric bill",
    debit: 0,
    credit: 150,
    running: 350,
  },
];

describe("GeneralLedgerEntries", () => {
  it("renders empty state when linesWithRunning is empty", () => {
    const markup = renderToStaticMarkup(
      <GeneralLedgerEntries
        activeAccount={mockAccount}
        linesWithRunning={[]}
        totalDebit={0}
        totalCredit={0}
        balance={0}
        dateFrom=""
        dateTo=""
      />,
    );
    expect(markup).toContain("accounting.ledger.noPostedTransactions");
  });

  it("renders cards layout in cards mode", () => {
    const markup = renderToStaticMarkup(
      <GeneralLedgerEntries
        activeAccount={mockAccount}
        linesWithRunning={mockLines}
        totalDebit={500}
        totalCredit={150}
        balance={350}
        dateFrom="2026-03-01"
        dateTo="2026-03-31"
        viewMode="cards"
      />,
    );
    expect(markup).toContain("JE-001");
    expect(markup).toContain("Opening Balance");
    expect(markup).toContain("JE-002");
    expect(markup).toContain("Utility Bill Payment");
    expect(markup).toContain("$500");
    expect(markup).toContain("$150");
    expect(markup).toContain("$350");
    expect(markup).toContain("accounting.ledger.closingBalance");
    expect(markup).not.toContain("<table");
  });

  it("renders table layout in table mode", () => {
    const markup = renderToStaticMarkup(
      <GeneralLedgerEntries
        activeAccount={mockAccount}
        linesWithRunning={mockLines}
        totalDebit={500}
        totalCredit={150}
        balance={350}
        dateFrom="2026-03-01"
        dateTo="2026-03-31"
        viewMode="table"
      />,
    );
    expect(markup).toContain("<table");
    expect(markup).toContain("JE-001");
    expect(markup).toContain("Opening Balance");
    expect(markup).toContain("JE-002");
    expect(markup).toContain("Utility Bill Payment");
    expect(markup).toContain("$500");
    expect(markup).toContain("$150");
    expect(markup).toContain("$350");
  });
});
