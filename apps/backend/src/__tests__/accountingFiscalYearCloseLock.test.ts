import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTx = vi.hoisted(() => ({ execute: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback(mockTx),
  withTenantRead: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback(mockTx),
}));

const mockFiscalYears = vi.hoisted(() => ({
  findFiscalYearByIdForUpdate: vi.fn(),
  listFiscalYearsByWorkspace: vi.fn(),
  saveFiscalYear: vi.fn().mockResolvedValue(undefined),
}));
const mockAccounting = vi.hoisted(() => ({
  findEntryIdBySource: vi.fn().mockResolvedValue(null),
  saveEntry: vi.fn().mockResolvedValue(undefined),
}));
const mockReport = vi.hoisted(() => ({
  aggregateAccountingReport: vi.fn().mockResolvedValue({ trialBalance: [] }),
}));
const mockPrefs = vi.hoisted(() => ({
  getAccountingPreferencesService: vi.fn().mockResolvedValue({
    retainedEarningsAccount: "acc-re",
  }),
}));
const mockAccounts = vi.hoisted(() => ({
  findAccountById: vi.fn().mockResolvedValue({
    id: "acc-re",
    type: "Equity",
    isActive: true,
  }),
}));
const mockAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../db/repositories/accountingFiscalYearsRepository.js", () => mockFiscalYears);
vi.mock("../db/repositories/accountingRepository.js", () => mockAccounting);
vi.mock("../db/repositories/accountingRepositoryReport.js", () => mockReport);
vi.mock("../services/accountingPreferencesService.js", () => mockPrefs);
vi.mock("../db/repositories/accountingAccountsRepository.js", () => mockAccounts);
vi.mock("../services/auditTrailService.js", () => ({ recordModernAuditEvent: mockAudit }));
vi.mock("../db/repositories/accountingCurrencySettingsRepository.js", () => ({
  getCurrencySettings: vi.fn().mockResolvedValue({
    functionalCurrency: "PKR",
    presentationCurrency: "PKR",
    locked: true,
    enabledCurrencies: [],
  }),
}));
vi.mock("../db/repositories/accountingFxRevaluationRepository.js", () => ({
  listForeignMonetaryBalances: vi.fn().mockResolvedValue([]),
  hasFxRevaluationBetween: vi.fn().mockResolvedValue(false),
}));

import { closeFiscalYearForTenant } from "../accounting/use-cases/accountingPeriodClose.js";

const OPEN_YEAR = {
  id: "fy-1",
  label: "2026",
  status: "open" as const,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) flattenStrings(item, out);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) flattenStrings(item, out);
  }
  return out;
}

describe("fiscal-year close lock ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFiscalYears.findFiscalYearByIdForUpdate.mockResolvedValue(OPEN_YEAR);
    mockFiscalYears.listFiscalYearsByWorkspace.mockResolvedValue([OPEN_YEAR]);
    mockReport.aggregateAccountingReport.mockResolvedValue({ trialBalance: [] });
  });

  it("takes the row lock and the per-year advisory lock before aggregating", async () => {
    await closeFiscalYearForTenant("tenant-1", "fy-1", "admin");

    const rowLockOrder = mockFiscalYears.findFiscalYearByIdForUpdate.mock.invocationCallOrder[0];
    const aggregateOrder = mockReport.aggregateAccountingReport.mock.invocationCallOrder[0];
    const advisoryOrder = mockTx.execute.mock.invocationCallOrder[0];
    expect(rowLockOrder).toBeDefined();
    expect(aggregateOrder).toBeDefined();
    expect(rowLockOrder).toBeLessThan(aggregateOrder);
    expect(advisoryOrder).toBeLessThan(aggregateOrder);

    const lockSql = mockTx.execute.mock.calls.map(([query]) => flattenStrings(query).join(" "));
    expect(lockSql.join(" ")).toContain("pg_advisory_xact_lock");
    expect(lockSql.join(" ")).toContain("fy:tenant-1:fy-1");
  });

  it("audits the close with the old and new status only", async () => {
    await closeFiscalYearForTenant("tenant-1", "fy-1", "admin");

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "accounting_fiscal_years",
        recordId: "fy-1",
        actionType: "UPDATE",
        oldState: { id: "fy-1", status: "open", endDate: "2026-12-31" },
      }),
    );
  });
});
