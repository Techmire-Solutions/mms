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
const mockAccounts = vi.hoisted(() => ({ findAccountById: vi.fn() }));
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
      trialBalance: [
        { id: "acc-rev", type: "Revenue", balance: 1000 },
        { id: "acc-exp", type: "Expense", balance: 600 },
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
