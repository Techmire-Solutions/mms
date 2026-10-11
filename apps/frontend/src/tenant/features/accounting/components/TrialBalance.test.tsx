import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const aggregatesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(" ")}` : key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({ formatCurrency: (value: number) => `$${value}` }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingApi", () => ({
  useAccountingReportAggregates: aggregatesMock,
}));

import { TrialBalance } from "./TrialBalance";

const fiscalYears = [
  {
    id: "fy-1",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  },
] as never;

function row(overrides: Record<string, unknown>) {
  return {
    id: "a1",
    code: "1000",
    name: "Cash",
    type: "Asset",
    totalDebit: 100,
    totalCredit: 0,
    balance: 100,
    ...overrides,
  };
}

function render(rows: ReturnType<typeof row>[], extra: Record<string, unknown> = {}) {
  aggregatesMock.mockReturnValue({
    data: { trialBalance: rows, ...extra },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  return renderToStaticMarkup(<TrialBalance fiscalYears={fiscalYears} />);
}

describe("TrialBalance", () => {
  beforeEach(() => {
    aggregatesMock.mockReset();
  });

  it("renders the server trial balance and reports a balanced period", () => {
    // The rows come from `report-aggregates`, not from client-side arithmetic over
    // whatever the page had loaded — that could only ever describe a slice of the
    // ledger while still showing a confident "Balanced" badge.
    const markup = render([
      row({ id: "a1", code: "1000", name: "Cash", type: "Asset", totalDebit: 500, totalCredit: 0 }),
      row({
        id: "a2",
        code: "4000",
        name: "Fees",
        type: "Revenue",
        totalDebit: 0,
        totalCredit: 500,
      }),
    ]);

    expect(markup).toContain("Cash");
    expect(markup).toContain("Fees");
    expect(markup).toContain("accounting.tb.balancedMessage");
    expect(markup).not.toContain("accounting.tb.unbalancedMessage");
  });

  it("reports a difference when the server rows do not balance", () => {
    const markup = render([
      row({ id: "a1", code: "1000", totalDebit: 500, totalCredit: 0 }),
      row({ id: "a2", code: "4000", type: "Revenue", totalDebit: 0, totalCredit: 400 }),
    ]);

    expect(markup).toContain("accounting.tb.unbalancedMessage");
    expect(markup).not.toContain("accounting.tb.balancedMessage");
  });

  it("does not call an empty period balanced", () => {
    // Zero debits equal zero credits, so a naive comparison declares an empty or
    // wrong-period trial balance "balanced" with a total of 0.
    const markup = render([]);

    expect(markup).toContain("accounting.ledger.noPostedTransactionsPeriod");
    expect(markup).not.toContain("accounting.tb.balancedMessage");
  });

  it("surfaces a load failure instead of an empty statement", () => {
    aggregatesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(<TrialBalance fiscalYears={fiscalYears} />);

    // An error must not be indistinguishable from "no transactions in this period".
    expect(markup).toContain("accounting.loadFailed");
    expect(markup).not.toContain("accounting.ledger.noPostedTransactionsPeriod");
  });

  it("matches in integer cents so float noise cannot unbalance a statement", () => {
    // 0.10 + 0.20 against 0.30 balances exactly in cents; a float comparison with
    // a 0.01 tolerance was the previous gate.
    const markup = render([
      row({ id: "a1", code: "1000", totalDebit: 0.1, totalCredit: 0 }),
      row({ id: "a2", code: "1010", totalDebit: 0.2, totalCredit: 0 }),
      row({ id: "a3", code: "4000", type: "Revenue", totalDebit: 0, totalCredit: 0.3 }),
    ]);

    expect(markup).toContain("accounting.tb.balancedMessage");
  });
});
