import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, guardianToken } from "./helpers/tokens.js";
import { accountingContract, type Account, type JournalEntry, type FiscalYear } from "@mms/shared";

/** Returns an ISO date string for N days before today (time-independent). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockLoadAccounts = vi.fn();
const mockLoadAccountsPage = vi.fn();
const mockUpsertAccounts = vi.fn();
const mockLoadEntries = vi.fn();
const mockLoadEntriesPage = vi.fn();
const mockUpsertEntries = vi.fn();
const mockLoadFiscalYears = vi.fn();
const mockLoadFiscalYearsPage = vi.fn();
const mockUpsertFiscalYears = vi.fn();
const mockDeleteJournalEntryById = vi.fn();
const mockRestoreJournalEntryById = vi.fn();
const mockBulkSoftDeleteJournalEntries = vi.fn();
const mockBulkRestoreJournalEntries = vi.fn();
const mockLoadAccountingCommandMetrics = vi.fn();
const mockLoadAccountingReportAggregates = vi.fn();
const mockDeleteAccountById = vi.fn();
const mockBulkSoftDeleteAccounts = vi.fn();

vi.mock("../accounting/use-cases/accountingUseCases.js", () => ({
  accountingUseCases: {
    loadAccounts: (...args: unknown[]) => mockLoadAccounts(...args),
    loadAccountsPage: (...args: unknown[]) => mockLoadAccountsPage(...args),
    upsertAccounts: (...args: unknown[]) => mockUpsertAccounts(...args),
    loadEntries: (...args: unknown[]) => mockLoadEntries(...args),
    loadEntriesPage: (...args: unknown[]) => mockLoadEntriesPage(...args),
    upsertEntries: (...args: unknown[]) => mockUpsertEntries(...args),
    loadFiscalYears: (...args: unknown[]) => mockLoadFiscalYears(...args),
    loadFiscalYearsPage: (...args: unknown[]) => mockLoadFiscalYearsPage(...args),
    upsertFiscalYears: (...args: unknown[]) => mockUpsertFiscalYears(...args),
    deleteJournalEntryById: (...args: unknown[]) => mockDeleteJournalEntryById(...args),
    restoreJournalEntryById: (...args: unknown[]) => mockRestoreJournalEntryById(...args),
    bulkSoftDeleteJournalEntries: (...args: unknown[]) => mockBulkSoftDeleteJournalEntries(...args),
    bulkRestoreJournalEntries: (...args: unknown[]) => mockBulkRestoreJournalEntries(...args),
    loadAccountingCommandMetrics: (...args: unknown[]) => mockLoadAccountingCommandMetrics(...args),
    loadAccountingReportAggregates: (...args: unknown[]) =>
      mockLoadAccountingReportAggregates(...args),
    createJournalEntry: vi.fn(),
    updateJournalEntryById: vi.fn(),
    deleteAccountById: (...args: unknown[]) => mockDeleteAccountById(...args),
    restoreAccountById: vi.fn(),
    bulkSoftDeleteAccounts: (...args: unknown[]) => mockBulkSoftDeleteAccounts(...args),
    bulkRestoreAccounts: vi.fn(),
    replaceAccounts: vi.fn(),
    replaceEntries: vi.fn(),
    replaceFiscalYears: vi.fn(),
  },
}));

const mockSeedDefaultChart = vi.fn();

vi.mock("../accounting/use-cases/seedDefaultChartOfAccounts.js", () => ({
  seedDefaultChartOfAccountsUseCase: (...args: unknown[]) => mockSeedDefaultChart(...args),
}));

const mockGetUserColumnPreferencesForModule = vi.fn();
const mockSetUserColumnPreferencesForModule = vi.fn();

vi.mock("../services/userColumnPreferencesService.js", () => ({
  getUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockGetUserColumnPreferencesForModule(...args),
  setUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockSetUserColumnPreferencesForModule(...args),
}));

const sampleAccount: Account = {
  id: "acc-1",
  code: "1000",
  name: "Cash",
  type: "Asset",
  subtype: "Current Asset",
  description: "Main Cash",
  isActive: true,
};

const sampleEntry: JournalEntry = {
  id: "je-1",
  date: daysAgo(5),
  ref: "JE-0001",
  description: "Initial Seed",
  status: "posted",
  created_by: "System",
  tags: ["Opening"],
  attachments: [],
  fiscal_year: "fy-2026",
  lines: [
    {
      id: "l1",
      account_id: "acc-1",
      debit: 100,
      credit: 0,
      description: "Debit Cash",
    },
    {
      id: "l2",
      account_id: "acc-2",
      debit: 0,
      credit: 100,
      description: "Credit Capital",
    },
  ],
};

const sampleFiscalYear: FiscalYear = {
  id: "fy-2026",
  label: "FY 2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
};

describe("accounting REST routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadAccounts.mockReset().mockResolvedValue([sampleAccount]);
    mockUpsertAccounts.mockReset().mockResolvedValue([sampleAccount]);
    mockLoadEntries.mockReset().mockResolvedValue([sampleEntry]);
    mockUpsertEntries.mockReset().mockResolvedValue([sampleEntry]);
    mockLoadFiscalYears.mockReset().mockResolvedValue([sampleFiscalYear]);
    mockUpsertFiscalYears.mockReset().mockResolvedValue([sampleFiscalYear]);
    mockDeleteJournalEntryById.mockReset().mockResolvedValue(true);
    mockRestoreJournalEntryById.mockReset().mockResolvedValue(true);
    mockBulkSoftDeleteJournalEntries.mockReset().mockResolvedValue({ succeeded: 1, failed: 0 });
    mockBulkRestoreJournalEntries.mockReset().mockResolvedValue({ succeeded: 1, failed: 0 });
    mockGetUserColumnPreferencesForModule.mockReset().mockResolvedValue([]);
    mockSetUserColumnPreferencesForModule.mockReset().mockResolvedValue(undefined);
    mockLoadAccountingCommandMetrics.mockReset().mockResolvedValue({
      totalEntries: 1,
      posted: 1,
      draft: 0,
      activeAccounts: 1,
      inactiveAccounts: 0,
      newThisPeriod: 1,
      postedVolume: 100,
      revenue: 0,
      expenses: 0,
      surplus: 0,
      assets: 100,
      liabilities: 0,
    });
    mockLoadAccountingReportAggregates.mockReset().mockResolvedValue({
      trialBalance: [],
      revenue: 0,
      expenses: 0,
      netSurplus: 0,
      assets: 0,
      liabilities: 0,
      equity: 0,
      netCashFlow: 0,
      cashInflow: 0,
      cashOutflow: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/accounting/accounts requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/accounts",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/accounting/accounts returns 403 for unauthorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/accounts",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${guardianToken(app, {
          id: "u-unauthorized",
          email: "unauth@test.com",
          name: "Unauthorized",
        })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("GET /api/accounting/accounts loads accounts for authorized users", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/accounts",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accounts: [sampleAccount] });
    expect(mockLoadAccounts).toHaveBeenCalled();
    await app.close();
  });

  it("PUT /api/accounting/accounts/bulk updates accounts", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/accounting/accounts/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleAccount]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accounts: [sampleAccount] });
    expect(mockUpsertAccounts).toHaveBeenCalledWith([sampleAccount]);
    await app.close();
  });

  it("GET /api/accounting/entries loads journal entries", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/entries",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ entries: [sampleEntry] });
    expect(mockLoadEntries).toHaveBeenCalled();
    await app.close();
  });

  it("PUT /api/accounting/entries/bulk updates journal entries", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/accounting/entries/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleEntry]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ entries: [sampleEntry] });
    expect(mockUpsertEntries).toHaveBeenCalledWith([sampleEntry]);
    await app.close();
  });

  it("GET /api/accounting/fiscal-years loads fiscal years", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/fiscal-years",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ fiscalYears: [sampleFiscalYear] });
    expect(mockLoadFiscalYears).toHaveBeenCalled();
    await app.close();
  });

  it("PUT /api/accounting/fiscal-years/bulk updates fiscal years", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/accounting/fiscal-years/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleFiscalYear]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ fiscalYears: [sampleFiscalYear] });
    expect(mockUpsertFiscalYears).toHaveBeenCalledWith([sampleFiscalYear]);
    await app.close();
  });

  it("GET /api/accounting/metrics loads SQL metrics for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        totalEntries: 1,
        posted: 1,
        draft: 0,
        activeAccounts: 1,
        inactiveAccounts: 0,
        newThisPeriod: 1,
        postedVolume: 100,
        revenue: 0,
        expenses: 0,
        surplus: 0,
        assets: 100,
        liabilities: 0,
      },
    });
    expect(mockLoadAccountingCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/accounting/metrics returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${guardianToken(app, {
          id: "u-unauthorized",
          email: "unauth@test.com",
          name: "Unauthorized",
        })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadAccountingCommandMetrics).not.toHaveBeenCalled();
    await app.close();
  });

  it("DELETE /api/accounting/entries/:id soft-deletes journal entry", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/accounting/entries/je-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteJournalEntryById).toHaveBeenCalledWith("je-1", "u-accountant");
    await app.close();
  });

  it("POST /api/accounting/entries/:id/restore restores journal entry", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/accounting/entries/je-1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreJournalEntryById).toHaveBeenCalledWith("je-1", "u-accountant");
    await app.close();
  });

  it("GET /api/accounting/report-aggregates returns server-side aggregates for accountant", async () => {
    mockLoadAccountingReportAggregates.mockResolvedValueOnce({
      trialBalance: [
        {
          id: "acc-1",
          code: "1000",
          name: "Cash",
          type: "Asset",
          totalDebit: 500,
          totalCredit: 100,
          balance: 400,
        },
      ],
      revenue: 1000,
      expenses: 600,
      netSurplus: 400,
      assets: 2500,
      liabilities: 1000,
      equity: 1500,
      netCashFlow: 300,
      cashInflow: 1000,
      cashOutflow: 700,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/report-aggregates?dateFrom=2026-01-01&dateTo=2026-12-31",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.revenue).toBe(1000);
    expect(body.expenses).toBe(600);
    expect(body.netSurplus).toBe(400);
    expect(body.trialBalance).toHaveLength(1);
    expect(mockLoadAccountingReportAggregates).toHaveBeenCalledWith({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
    await app.close();
  });

  it("GET /api/accounting/report-aggregates rejects unauthorized users with 403", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${guardianToken(app, {
          id: "u-unauthorized",
          email: "unauth@test.com",
          name: "Unauthorized",
        })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadAccountingReportAggregates).not.toHaveBeenCalled();
    await app.close();
  });
});

/**
 * Contract ↔ router drift gate.
 *
 * `accountingContract` declares the whole Accounting API surface and the frontend
 * is typed from it, but `accountingContractRouter` implements only the three list
 * operations — the remaining paths are served by the shared CRUD/setup route
 * factories. Because the router is cast through `as unknown as
 * RouterImplementation<...>`, TypeScript cannot see that gap, and an operation
 * added to the contract without a matching route would silently 404 in production.
 * This test makes that failure loud. It is also what caught the `replace*`
 * operations being advertised while the served handler was an additive upsert.
 */
describe("accounting contract ↔ registered routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("registers every operation declared in accountingContract", async () => {
    const app = await buildApp();
    const operations = Object.entries(
      accountingContract as unknown as Record<string, { method: string; path: string }>,
    );
    expect(operations.length).toBeGreaterThan(0);

    const missing = operations
      .filter(
        ([, operation]) =>
          !app.hasRoute({ method: operation.method as never, url: operation.path }),
      )
      .map(([name, operation]) => `${name}: ${operation.method} ${operation.path}`);

    expect(missing).toEqual([]);
    await app.close();
  });
});

/**
 * The chart-of-accounts archive guard ("Cannot archive account with active
 * ledger entries") existed on the use case but was reachable from no HTTP route,
 * so the UI's only delete was an unguarded `isActive: false` bulk write.
 */
describe("account archive routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockDeleteAccountById.mockReset();
    mockBulkSoftDeleteAccounts.mockReset();
  });

  it("DELETE /api/accounting/accounts/:id requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/accounting/accounts/acc-1",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("DELETE /api/accounting/accounts/:id archives through the guarded use case", async () => {
    mockDeleteAccountById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/accounting/accounts/acc-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
      payload: { deletionReason: "no longer used" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, archived: true });
    expect(mockDeleteAccountById).toHaveBeenCalledWith(
      "acc-1",
      expect.any(String),
      "no longer used",
    );
    await app.close();
  });

  it("DELETE /api/accounting/accounts/:id surfaces the ledger guard as 400", async () => {
    mockDeleteAccountById.mockRejectedValue(
      Object.assign(new Error("Cannot archive account with active ledger entries"), {
        statusCode: 400,
      }),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/accounting/accounts/acc-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("active ledger entries");
    await app.close();
  });

  it("POST /api/accounting/accounts/bulk-delete reports partial archives", async () => {
    mockBulkSoftDeleteAccounts.mockResolvedValue({ succeeded: 1, failed: 1 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/accounting/accounts/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
      payload: { ids: ["acc-1", "acc-2"] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: true, succeeded: 1, failed: 1 });
    await app.close();
  });
});

describe("default chart of accounts seed route", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockSeedDefaultChart.mockReset();
  });

  const seed = async (authorization?: string) => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/accounting/accounts/seed-default",
      headers: { host: "demo.localhost", ...(authorization ? { authorization } : {}) },
    });
    await app.close();
    return res;
  };

  it("requires auth", async () => {
    const res = await seed();
    expect(res.statusCode).toBe(401);
    expect(mockSeedDefaultChart).not.toHaveBeenCalled();
  });

  it("denies roles without account write access", async () => {
    const app = await buildApp();
    const token = guardianToken(app, {
      id: "u-guardian",
      email: "guardian@test.com",
      name: "Guardian",
    });
    await app.close();
    const res = await seed(`Bearer ${token}`);
    expect(res.statusCode).toBe(403);
    expect(mockSeedDefaultChart).not.toHaveBeenCalled();
  });

  it("seeds for an accountant and returns the created count", async () => {
    mockSeedDefaultChart.mockResolvedValue({
      count: 61,
      defaultsApplied: { retainedEarnings: true, cashAccount: false },
    });
    const app = await buildApp();
    const token = accountantToken(app);
    await app.close();
    const res = await seed(`Bearer ${token}`);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      success: true,
      count: 61,
      defaultsApplied: { retainedEarnings: true, cashAccount: false },
    });
  });

  it("returns 409 when a chart already exists", async () => {
    const { ConflictError } = await import("../lib/httpErrors.js");
    mockSeedDefaultChart.mockRejectedValue(new ConflictError("A Chart of Accounts already exists"));
    const app = await buildApp();
    const token = accountantToken(app);
    await app.close();
    const res = await seed(`Bearer ${token}`);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ type: "conflict" });
  });
});
