import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingPeriodEndPanel } from "./AccountingPeriodEndPanel";
import type { Account, FiscalYear, HedgeRelationship } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingFx", () => ({
  useAccountingCurrencySettings: () => ({
    data: { functionalCurrency: "PKR", enabledCurrencies: ["USD"] },
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useExchangeRateDraft", () => ({
  useExchangeRateDraft: () => ({
    draft: {
      fromCurrency: "USD",
      toCurrency: "PKR",
      rateDate: "2026-10-26",
      rateType: "spot",
      rate: "280",
      overrideReason: "",
    },
    setDraft: vi.fn(),
    overriding: false,
    rates: [],
    isLoading: false,
    isError: false,
    saving: false,
    handleSave: vi.fn(),
    refetch: vi.fn(),
    error: null,
  }),
}));

const previewRun = {
  id: "preview",
  revaluationDate: "2026-11-30",
  status: "preview" as const,
  functionalCurrency: "PKR",
  totalUnrealized: "3000.00",
  entryId: null,
  reversalEntryId: null,
  lines: [],
};

vi.mock("@/tenant/features/accounting/hooks/useFxRevaluationPanel", () => ({
  useFxRevaluationPanel: () => ({
    revaluationDate: "2026-11-30",
    setRevaluationDate: vi.fn(),
    previewRun,
    runs: [],
    runsLoading: false,
    runsError: false,
    refetchRuns: vi.fn(),
    alreadyPosted: false,
    previewing: false,
    posting: false,
    handlePreview: vi.fn(),
    handlePost: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useHyperinflationPanel", () => ({
  useHyperinflationPanel: () => ({
    settings: { enabled: true, netMonetaryAccountId: "nmp", indexName: "CPI" },
    indices: [{ indexDate: "2026-12-31", value: "150", source: "CPI" }],
    indicesLoading: false,
    indexDate: "2026-12-31",
    indexValue: "150",
    setIndexDate: vi.fn(),
    setIndexValue: vi.fn(),
    savingIndex: false,
    handleAddIndex: vi.fn(),
    restatementDate: "2026-12-31",
    setRestatementDate: vi.fn(),
    previewRun: null,
    runs: [],
    runsLoading: false,
    alreadyPosted: false,
    previewing: false,
    posting: false,
    handlePreview: vi.fn(),
    handlePost: vi.fn(),
  }),
}));

const hedge: HedgeRelationship = {
  id: "hedge-1",
  name: "Forward Hedge",
  hedgeType: "cash_flow",
  direction: "buy",
  currency: "USD",
  notional: "1000",
  contractRate: "280",
  designationRate: "280",
  designationDate: "2026-10-01",
  maturityDate: "2027-01-31",
  hedgedItem: "Books",
  riskManagementObjective: "Fix cost",
  instrumentAccountId: "deriv",
  reserveAccountId: "cfhr",
  pnlAccountId: "hpl",
  status: "active",
  settledReserve: "0",
  valuations: [],
};

vi.mock("@/tenant/features/accounting/hooks/useHedgesPanel", () => ({
  useHedgesPanel: () => ({
    hedges: [hedge],
    loading: false,
    loadError: false,
    refetch: vi.fn(),
    valuationDate: "2026-10-26",
    setValuationDate: vi.fn(),
    designating: false,
    setDesignating: vi.fn(),
    pending: null,
    setPending: vi.fn(),
    valuing: false,
    acting: false,
    handleCreate: vi.fn(),
    handleValue: vi.fn(),
    handleAction: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingOpeningBalancesState", () => ({
  useAccountingOpeningBalancesState: () => ({
    t: (key: string) => key,
    openYears: [{ id: "fy-1", label: "FY 2026" }],
    fiscalYearId: "fy-1",
    setFiscalYearId: vi.fn(),
    accountId: "acc-1",
    setAccountId: vi.fn(),
    debit: "100",
    setDebit: vi.fn(),
    credit: "",
    setCredit: vi.fn(),
    formError: null,
    balances: [{ id: "ob-1", fiscalYearId: "fy-1", accountId: "acc-1", debit: 100, credit: 0 }],
    rowsReady: true,
    accountLabel: () => "Cash",
    totals: { debitCents: 10000, creditCents: 10000, postable: true },
    postBlockedReason: null,
    handleAdd: vi.fn(),
    handleRemove: vi.fn(),
    handlePost: vi.fn(),
    savePending: false,
    postPending: false,
    isError: false,
  }),
}));

const accounts: Account[] = [
  { id: "acc-1", code: "1000", name: "Cash", type: "Asset", isActive: true },
] as Account[];

const fiscalYears: FiscalYear[] = [
  {
    id: "fy-1",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  },
] as FiscalYear[];

describe("AccountingPeriodEndPanel", () => {
  it("given canWrite=true, should render all period-end sections with their action buttons", () => {
    const html = renderToStaticMarkup(
      <AccountingPeriodEndPanel
        accounts={accounts}
        fiscalYears={fiscalYears}
        decimalSeparator="period"
        canWrite
      />,
    );

    // Intro hint
    expect(html).toContain("accounting.periodEnd.hint");

    // 1. Exchange rates
    expect(html).toContain("accounting.settings.fx.rates.title");
    expect(html).toContain("accounting.settings.fx.rates.add");

    // 2. FX revaluation
    expect(html).toContain("accounting.settings.secFxReval");
    expect(html).toContain("accounting.settings.fxReval.post");

    // 3. IAS 29
    expect(html).toContain("accounting.settings.ias29.indexTitle");
    expect(html).toContain("accounting.settings.ias29.addIndex");

    // 4. Hedges
    expect(html).toContain("accounting.settings.secHedges");
    expect(html).toContain("accounting.settings.hedges.designate");
    expect(html).toContain("accounting.settings.hedges.value");

    // 5. Opening balances
    expect(html).toContain("accounting.settings.secOpening");
    expect(html).toContain("accounting.settings.opening.post");
  });

  it("given canWrite=false, should render sections but hide actions", () => {
    const html = renderToStaticMarkup(
      <AccountingPeriodEndPanel
        accounts={accounts}
        fiscalYears={fiscalYears}
        decimalSeparator="period"
        canWrite={false}
      />,
    );

    // Headers are visible
    expect(html).toContain("accounting.periodEnd.hint");
    expect(html).toContain("accounting.settings.fx.rates.title");
    expect(html).toContain("accounting.settings.secFxReval");
    expect(html).toContain("accounting.settings.secHedges");
    expect(html).toContain("accounting.settings.secOpening");

    // Actions are hidden
    expect(html).not.toContain("accounting.settings.fx.rates.add");
    expect(html).not.toContain("accounting.settings.fxReval.post");
    expect(html).not.toContain("accounting.settings.ias29.addIndex");
    expect(html).not.toContain("accounting.settings.hedges.designate");
    expect(html).not.toContain("accounting.settings.hedges.value");
    expect(html).not.toContain("accounting.settings.opening.post");
  });
});
