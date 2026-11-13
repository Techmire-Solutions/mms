import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAccountingRepo = vi.hoisted(() => ({
  findEntryIdBySource: vi.fn(),
  saveEntry: vi.fn(),
}));

const mockFiscalYearsRepo = vi.hoisted(() => ({
  findFiscalYearByIdForUpdate: vi.fn(),
  listFiscalYearsByWorkspace: vi.fn(),
  saveFiscalYear: vi.fn(),
}));

const mockRecordModernAuditEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mockRecordModernAuditEvent,
}));

const mockReportRepo = vi.hoisted(() => ({
  aggregateAccountingReport: vi.fn(),
}));

const mockPrefs = vi.hoisted(() => ({
  getAccountingPreferencesService: vi.fn(),
}));
const mockAccounts = vi.hoisted(() => ({
  findAccountById: vi.fn(),
  // The close now runs the same postability guard as the manual paths: the closing
  // lines must target active, non-summary accounts.
  lockPostableAccounts: vi.fn(async (_tenant: string, ids: string[]) =>
    ids.map((id) => ({ id, isActive: true, hasChildren: false })),
  ),
}));
vi.mock("../db/repositories/accountingAccountsRepository.js", () => mockAccounts);

vi.mock("../db/repositories/accountingRepository.js", () => mockAccountingRepo);
vi.mock("../db/repositories/accountingFiscalYearsRepository.js", () => mockFiscalYearsRepo);
vi.mock("../db/repositories/accountingRepositoryReport.js", () => mockReportRepo);
vi.mock("../services/accountingPreferencesService.js", () => mockPrefs);

const mockFxReval = vi.hoisted(() => ({
  listForeignMonetaryBalances: vi.fn().mockResolvedValue([]),
  hasFxRevaluationBetween: vi.fn().mockResolvedValue(false),
}));
vi.mock("../db/repositories/accountingFxRevaluationRepository.js", () => mockFxReval);

const mockHedgesRepo = vi.hoisted(() => ({
  listHedgeRelationships: vi.fn().mockResolvedValue([]),
}));
const mockHyperRepo = vi.hoisted(() => ({
  getHyperinflationSettings: vi.fn(),
  findIas29RunId: vi.fn().mockResolvedValue(null),
}));
vi.mock("../db/repositories/accountingHedgesRepository.js", () => mockHedgesRepo);
vi.mock("../db/repositories/accountingHyperinflationRepository.js", () => mockHyperRepo);
vi.mock("../db/repositories/accountingCurrencySettingsRepository.js", () => ({
  getCurrencySettings: vi.fn().mockResolvedValue({
    functionalCurrency: "PKR",
    presentationCurrency: "PKR",
    locked: true,
    enabledCurrencies: ["USD"],
  }),
}));

import { closeFiscalYearForTenant } from "../accounting/use-cases/accountingPeriodClose.js";

const OPEN_YEAR = {
  id: "fy-1",
  label: "2025-2026",
  status: "open" as const,
  startDate: "2025-01-01",
  endDate: "2025-12-31",
};

describe("accountingPeriodClose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 0255 close preconditions: no active hedge and IAS 29 disabled unless a test
    // says otherwise, so the existing cases keep closing.
    mockHedgesRepo.listHedgeRelationships.mockResolvedValue([]);
    mockHyperRepo.getHyperinflationSettings.mockResolvedValue({
      enabled: false,
      netMonetaryAccountId: null,
      appliesFrom: null,
      indexName: "",
    });
    mockHyperRepo.findIas29RunId.mockResolvedValue(null);
    mockAccounts.findAccountById.mockResolvedValue({
      id: "acc-re",
      type: "Equity",
      isActive: true,
    });
    mockFiscalYearsRepo.listFiscalYearsByWorkspace.mockResolvedValue([OPEN_YEAR]);
  });

  it("throws 404 if fiscal year is not found", async () => {
    mockFiscalYearsRepo.findFiscalYearByIdForUpdate.mockResolvedValue(null);

    await expect(closeFiscalYearForTenant("t-1", "fy-missing", "admin")).rejects.toThrow(
      /Fiscal year not found/,
    );
  });

  it("throws 422 if fiscal year is already closed", async () => {
    mockFiscalYearsRepo.findFiscalYearByIdForUpdate.mockResolvedValue({
      ...OPEN_YEAR,
      status: "closed",
    });

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).rejects.toThrow(
      /Fiscal year is already closed/,
    );
  });

  it("throws 422 if retained earnings account is not specified or configured", async () => {
    mockFiscalYearsRepo.findFiscalYearByIdForUpdate.mockResolvedValue(OPEN_YEAR);
    mockPrefs.getAccountingPreferencesService.mockResolvedValue(null);

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).rejects.toThrow(
      /Retained earnings account is required/,
    );
  });

  it("locks the fiscal year before aggregating and marks it closed", async () => {
    mockFiscalYearsRepo.findFiscalYearByIdForUpdate.mockResolvedValue(OPEN_YEAR);
    mockPrefs.getAccountingPreferencesService.mockResolvedValue({
      retainedEarningsAccount: "acc-re",
    });
    mockReportRepo.aggregateAccountingReport.mockResolvedValue({
      // The aggregate always returns both sides; the close verifies the year's
      // ledger balances (Dr Cash 1000 / Cr Revenue 1000, Dr Expense 600 / Cr Cash 600).
      trialBalance: [
        { id: "acc-cash", type: "Asset", totalDebit: 1000, totalCredit: 600, balance: 400 },
        { id: "acc-rev", type: "Revenue", totalDebit: 0, totalCredit: 1000, balance: 1000 },
        { id: "acc-exp", type: "Expense", totalDebit: 600, totalCredit: 0, balance: 600 },
      ],
    });
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
    mockAccountingRepo.saveEntry.mockResolvedValue(undefined);
    mockFiscalYearsRepo.saveFiscalYear.mockResolvedValue(undefined);

    const result = await closeFiscalYearForTenant("t-1", "fy-1", "admin-user");

    expect(result.status).toBe("closed");
    expect(result.closedBy).toBe("admin-user");
    expect(mockFiscalYearsRepo.findFiscalYearByIdForUpdate).toHaveBeenCalledWith("t-1", "fy-1");
    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        source_type: "closing",
        source_id: "fy-1",
        status: "posted",
      }),
    );
    expect(mockFiscalYearsRepo.saveFiscalYear).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        id: "fy-1",
        status: "closed",
      }),
    );
    expect(mockRecordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "accounting_fiscal_years",
        recordId: "fy-1",
        actionType: "UPDATE",
      }),
    );
  });

  it.each([
    null,
    { type: "Asset", isActive: true },
    { type: "Expense", isActive: true },
    { type: "Equity", isActive: false },
    { type: "Equity", isActive: true, deletedAt: "2026-01-01T00:00:00Z" },
  ])("rejects an unavailable or non-equity retained earnings account: %j", async (account) => {
    mockFiscalYearsRepo.findFiscalYearByIdForUpdate.mockResolvedValue(OPEN_YEAR);
    mockAccounts.findAccountById.mockResolvedValue(account);
    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin", "acc-invalid")).rejects.toThrow(
      "active Equity account",
    );
    expect(mockAccounts.findAccountById).toHaveBeenCalledWith("t-1", "acc-invalid");
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
    expect(mockFiscalYearsRepo.saveFiscalYear).not.toHaveBeenCalled();
  });

  it("given open foreign monetary balances and no year-end revaluation, should refuse to close", async () => {
    // Arrange
    mockFiscalYearsRepo.findFiscalYearByIdForUpdate.mockResolvedValue(OPEN_YEAR);
    mockPrefs.getAccountingPreferencesService.mockResolvedValue({
      retainedEarningsAccount: "acc-re",
    });
    mockFxReval.listForeignMonetaryBalances.mockResolvedValueOnce([
      {
        accountId: "ar",
        accountCode: "1100",
        accountName: "AR",
        currency: "USD",
        openTxn: "1000",
        carryingFunc: "280000",
      },
    ]);

    // Act
    const result = closeFiscalYearForTenant("t-1", "fy-1", "admin");

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
    await expect(result).rejects.toThrow(/FX revaluation for 2025-12-31/);
    expect(mockFxReval.hasFxRevaluationBetween).toHaveBeenCalledWith(
      "t-1",
      "2025-12-31",
      "2025-12-31",
    );
  });
});

describe("year-end preconditions for hedges and IAS 29 (0255)", () => {
  const balancedReport = {
    trialBalance: [
      { id: "acc-cash", type: "Asset", totalDebit: 1000, totalCredit: 600, balance: 400 },
      { id: "acc-rev", type: "Revenue", totalDebit: 0, totalCredit: 1000, balance: 1000 },
      { id: "acc-exp", type: "Expense", totalDebit: 600, totalCredit: 0, balance: 600 },
    ],
  };
  const hedge = (overrides: Record<string, unknown> = {}) => ({
    id: "hedge-1",
    name: "USD import hedge",
    status: "active" as const,
    designationDate: "2025-07-01",
    maturityDate: "2026-06-30",
    valuations: [] as Array<{ kind: string; valuationDate: string }>,
    ...overrides,
  });

  beforeEach(() => {
    mockFiscalYearsRepo.findFiscalYearByIdForUpdate.mockResolvedValue(OPEN_YEAR);
    mockPrefs.getAccountingPreferencesService.mockResolvedValue({
      retainedEarningsAccount: "acc-re",
    });
    mockReportRepo.aggregateAccountingReport.mockResolvedValue(balancedReport);
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
    mockAccountingRepo.saveEntry.mockResolvedValue(undefined);
    mockFiscalYearsRepo.saveFiscalYear.mockResolvedValue(undefined);
  });

  it("refuses to close while an in-range hedge has no closing-date valuation", async () => {
    mockHedgesRepo.listHedgeRelationships.mockResolvedValue([
      hedge({ valuations: [{ kind: "valuation", valuationDate: "2025-11-30" }] }),
    ]);

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).rejects.toThrow(
      /year-end hedge valuation for 2025-12-31 first: USD import hedge/,
    );
    expect(mockFiscalYearsRepo.saveFiscalYear).not.toHaveBeenCalled();
  });

  it("closes once the closing-date hedge valuation exists", async () => {
    mockHedgesRepo.listHedgeRelationships.mockResolvedValue([
      hedge({ valuations: [{ kind: "valuation", valuationDate: "2025-12-31" }] }),
    ]);

    const result = await closeFiscalYearForTenant("t-1", "fy-1", "admin");

    expect(result.status).toBe("closed");
  });

  it("ignores a hedge that matured before the closing date", async () => {
    mockHedgesRepo.listHedgeRelationships.mockResolvedValue([
      hedge({ maturityDate: "2025-06-30" }),
    ]);

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).resolves.toMatchObject({
      status: "closed",
    });
  });

  it("ignores a settled or discontinued hedge (its fair value stays on the books)", async () => {
    mockHedgesRepo.listHedgeRelationships.mockResolvedValue([
      hedge({ status: "settled" }),
      hedge({ id: "hedge-2", status: "discontinued" }),
    ]);

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).resolves.toMatchObject({
      status: "closed",
    });
  });

  it("refuses to close an enabled hyperinflationary year without its restatement", async () => {
    mockHyperRepo.getHyperinflationSettings.mockResolvedValue({
      enabled: true,
      netMonetaryAccountId: "acc-nmp",
      appliesFrom: "2025-01-01",
      indexName: "CPI",
    });
    mockHyperRepo.findIas29RunId.mockResolvedValue(null);

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).rejects.toThrow(
      /IAS 29 restatement for 2025-12-31/,
    );
    expect(mockFiscalYearsRepo.saveFiscalYear).not.toHaveBeenCalled();
  });

  it("closes an enabled hyperinflationary year once the restatement is posted", async () => {
    mockHyperRepo.getHyperinflationSettings.mockResolvedValue({
      enabled: true,
      netMonetaryAccountId: "acc-nmp",
      appliesFrom: "2025-01-01",
      indexName: "CPI",
    });
    mockHyperRepo.findIas29RunId.mockResolvedValue("ias29-run-1");

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).resolves.toMatchObject({
      status: "closed",
    });
  });

  it("does not require a restatement before the hyperinflationary period starts", async () => {
    mockHyperRepo.getHyperinflationSettings.mockResolvedValue({
      enabled: true,
      netMonetaryAccountId: "acc-nmp",
      appliesFrom: "2026-01-01",
      indexName: "CPI",
    });

    await expect(closeFiscalYearForTenant("t-1", "fy-1", "admin")).resolves.toMatchObject({
      status: "closed",
    });
    expect(mockHyperRepo.findIas29RunId).not.toHaveBeenCalled();
  });
});
