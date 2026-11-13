import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountingReportAggregates } from "@mms/shared";

const mockWorkspace = vi.fn();
const mockCurrency = vi.fn();
const mockAggregates = vi.fn();
const mockDocument = vi.fn();

vi.mock("../services/workspaceService.js", () => ({
  getWorkspaceBySubdomain: (...args: unknown[]) => mockWorkspace(...args),
}));

vi.mock("../db/repositories/accountingCurrencySettingsRepository.js", () => ({
  getCurrencySettings: (...args: unknown[]) => mockCurrency(...args),
}));

vi.mock("../db/repositories/accountingLedgerDocumentRepository.js", () => ({
  loadLedgerDocument: (...args: unknown[]) => mockDocument(...args),
  // The report-documents adapter imports both loaders; see the export-service suite.
  listLedgerExportRows: vi.fn(),
}));

vi.mock("../accounting/use-cases/accountingUseCases.js", () => ({
  accountingUseCases: {
    loadAccountingReportAggregates: (...args: unknown[]) => mockAggregates(...args),
  },
}));

import { bindRequestTenant } from "../lib/tenantContext.js";
import {
  buildAccountingReportDocument,
  buildTrialBalanceDocument,
} from "../accounting/use-cases/accountingReportPdfUseCases.js";

const aggregates = (): AccountingReportAggregates => ({
  revenue: 1000,
  expenses: 400,
  netSurplus: 600,
  assets: 5000,
  liabilities: 1000,
  equity: 4000,
  cashInflow: 0,
  cashOutflow: 0,
  netCashFlow: 0,
  netCashFlowIndirect: 0,
  cashFlowAdjustments: { depreciation: 0, receivables: 0, payables: 0, other: 0 },
  trialBalance: [
    {
      id: "a1",
      code: "1000",
      name: "Cash",
      type: "Asset",
      subtype: "",
      totalDebit: 5000,
      totalCredit: 0,
      balance: 5000,
    },
    {
      id: "l1",
      code: "2000",
      name: "Payable",
      type: "Liability",
      subtype: "",
      totalDebit: 0,
      totalCredit: 1000,
      balance: 1000,
    },
    {
      id: "r1",
      code: "4000",
      name: "Fees",
      type: "Revenue",
      subtype: "",
      totalDebit: 0,
      totalCredit: 1000,
      balance: 1000,
    },
  ],
  incomeStatementTrialBalance: [],
  balanceSheetTrialBalance: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mockWorkspace.mockResolvedValue({ madrasaName: "Demo Madrasa" });
  mockCurrency.mockResolvedValue({ functionalCurrency: "PKR" });
  bindRequestTenant("demo");
});

describe("accounting report PDF documents", () => {
  it("builds a BiDi trial-balance payload with one section per account type", async () => {
    const document = await buildTrialBalanceDocument(
      { kind: "trial-balance", dateFrom: "2026-01-01", dateTo: "2026-12-31", lang: "ar" },
      aggregates(),
    );

    expect(document.template).toBe("trial-balance");
    expect(document.lang).toBe("ar");
    expect(document.direction).toBe("rtl");
    const data = document.data as {
      sections: Array<{ title: string; rows: unknown[]; totalDebit: string }>;
      totalDebit: string;
      totalCredit: string;
      currency: string;
      direction: string;
    };
    expect(data.currency).toBe("PKR");
    expect(data.direction).toBe("rtl");
    expect(data.sections.map((section) => section.title)).toEqual([
      "Assets",
      "Liabilities",
      "Revenue",
    ]);
    expect(data.totalDebit).toBe("5000.00");
    expect(data.totalCredit).toBe("2000.00");
  });

  it("renders a general-ledger PDF from the snapshot document", async () => {
    mockDocument.mockResolvedValue({
      account: { id: "a1", code: "1000", name: "Cash", type: "Asset", subtype: "" },
      openingCents: 10_000,
      movement: { debitCents: 5_000, creditCents: 2_000 },
      truncated: false,
      lines: [
        {
          id: "l1",
          entryId: "e1",
          date: "2026-11-01",
          ref: "JE-1",
          description: "Fee receipt",
          lineDescription: "",
          debitCents: 5_000,
          creditCents: 0,
          runningCents: 5_000,
        },
      ],
    });

    const document = await buildAccountingReportDocument({
      kind: "general-ledger",
      accountId: "a1",
      dateTo: "2026-11-30",
    });

    expect(document.template).toBe("financial-ledger");
    const data = document.data as { entries: Array<{ balance: string }>; netBalance: string };
    // Running balance includes the opening balance carried into the window.
    expect(data.entries[0].balance).toBe("150.00");
    expect(data.netBalance).toBe("130.00");
  });

  it("refuses a ledger that exceeds the printable line ceiling", async () => {
    mockDocument.mockResolvedValue({
      account: { id: "a1", code: "1000", name: "Cash", type: "Asset", subtype: "" },
      openingCents: 0,
      movement: { debitCents: 0, creditCents: 0 },
      truncated: true,
      lines: [],
    });

    await expect(
      buildAccountingReportDocument({ kind: "general-ledger", accountId: "a1" }),
    ).rejects.toMatchObject({ statusCode: 413 });
  });
});
