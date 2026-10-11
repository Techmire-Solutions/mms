import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartOfAccountsListDesktopTable } from "./ChartOfAccountsListDesktopTable";
import type { Account } from "@/lib/data/accountingData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

const mockAccounts: Account[] = [
  {
    id: "acc-1",
    code: "1010",
    name: "Main Cash Account",
    type: "Asset",
    subtype: "Cash & Cash Equivalents",
    description: "Primary cash account",
    isActive: true,
  },
];

const baseProps = {
  accounts: mockAccounts,
  filteredAccounts: mockAccounts,
  balanceConfig: {
    debit: { label: "Dr", cls: "badge-debit" },
    credit: { label: "Cr", cls: "badge-credit" },
  },
  canWrite: true,
  isColumnVisible: () => true,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onReactivate: vi.fn(),
};

describe("ChartOfAccountsListDesktopTable", () => {
  it("renders card view when viewMode is cards", () => {
    const html = renderToStaticMarkup(
      <ChartOfAccountsListDesktopTable {...baseProps} viewMode="cards" />,
    );

    expect(html).toContain("Main Cash Account");
    expect(html).toContain("1010");
    expect(html).toContain("Cash &amp; Cash Equivalents");
    expect(html).not.toContain("<table");
  });

  it("renders table view when viewMode is table", () => {
    const html = renderToStaticMarkup(
      <ChartOfAccountsListDesktopTable {...baseProps} viewMode="table" />,
    );

    expect(html).toContain("Main Cash Account");
    expect(html).toContain("1010");
    expect(html).toContain("<table");
  });
});
