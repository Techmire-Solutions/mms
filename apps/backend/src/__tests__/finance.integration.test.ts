import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, teacherToken } from "./helpers/tokens.js";

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
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo"
          ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true }
          : null,
      ),
  };
});

const mockLoadInvoices = vi.fn();
const mockLoadInvoicesPage = vi.fn();
const mockLoadPaymentsPage = vi.fn();
const mockBulkDeleteInvoices = vi.fn();
const mockBulkRestoreInvoices = vi.fn();
const mockBulkDeletePayments = vi.fn();
const mockBulkRestorePayments = vi.fn();
const mockLoadFinanceReportAggregates = vi.fn();
const mockLoadFinanceCommandMetrics = vi.fn();

vi.mock("../finance/use-cases/financeUseCases.js", () => ({
  financeUseCases: {
    loadInvoices: (...args: unknown[]) => mockLoadInvoices(...args),
    loadInvoicesPage: (...args: unknown[]) => mockLoadInvoicesPage(...args),
    createInvoice: vi.fn(),
    updateInvoiceById: vi.fn(),
    deleteInvoiceById: vi.fn(),
    restoreInvoiceById: vi.fn(),
    bulkSoftDeleteInvoices: (...args: unknown[]) => mockBulkDeleteInvoices(...args),
    bulkRestoreInvoices: (...args: unknown[]) => mockBulkRestoreInvoices(...args),
    getInvoiceById: vi.fn(),
    bulkUpdateInvoicesStatus: vi.fn(),
    loadPayments: vi.fn().mockResolvedValue([]),
    loadPaymentsPage: (...args: unknown[]) => mockLoadPaymentsPage(...args),
    createPayment: vi.fn(),
    updatePaymentById: vi.fn(),
    deletePaymentById: vi.fn(),
    restorePaymentById: vi.fn(),
    bulkSoftDeletePayments: (...args: unknown[]) => mockBulkDeletePayments(...args),
    bulkRestorePayments: (...args: unknown[]) => mockBulkRestorePayments(...args),
    getPaymentById: vi.fn(),
    loadFinanceReportAggregates: (...args: unknown[]) => mockLoadFinanceReportAggregates(...args),
    loadFinanceCommandMetrics: (...args: unknown[]) => mockLoadFinanceCommandMetrics(...args),
    loadFinanceWidgetAggregates: vi.fn().mockResolvedValue({}),
  },
}));

describe("finance REST routes integration", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadInvoices.mockReset().mockResolvedValue([]);
    mockLoadInvoicesPage.mockReset().mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    mockLoadPaymentsPage.mockReset().mockResolvedValue({
      payments: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    mockBulkDeleteInvoices.mockReset().mockResolvedValue({ succeeded: 2, failed: 0 });
    mockBulkRestoreInvoices.mockReset().mockResolvedValue({ succeeded: 2, failed: 0 });
    mockBulkDeletePayments.mockReset().mockResolvedValue({ succeeded: 2, failed: 0 });
    mockBulkRestorePayments.mockReset().mockResolvedValue({ succeeded: 2, failed: 0 });
    mockLoadFinanceReportAggregates.mockReset().mockResolvedValue({
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/finance/invoices requires auth header", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/invoices",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/finance/invoices returns invoices for accountant", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/invoices",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app, { email: "finance@test.com", name: "Finance User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      invoices: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    await app.close();
  });

  it("GET includeDeleted requests deleted-only invoice page", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/invoices?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app, { email: "finance@test.com", name: "Finance User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadInvoicesPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("GET includeDeleted requests deleted-only payment page", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/payments?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app, { email: "finance@test.com", name: "Finance User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadPaymentsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("forbids teacher access to deleted finance records", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/invoices?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("bulk deletes and restores invoices", async () => {
    const app = await buildApp();
    const headers = {
      host: "demo.localhost",
      authorization: `Bearer ${accountantToken(app, { email: "finance@test.com", name: "Finance User" })}`,
    };
    const deleted = await app.inject({
      method: "POST",
      url: "/api/finance/invoices/bulk-delete",
      headers,
      payload: { ids: ["inv-1", "inv-2"] },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ success: true, succeeded: 2, failed: 0 });

    const restored = await app.inject({
      method: "POST",
      url: "/api/finance/invoices/bulk-restore",
      headers,
      payload: { ids: ["inv-1", "inv-2"] },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toEqual({ success: true, succeeded: 2, failed: 0 });
    await app.close();
  });

  it("bulk deletes and restores payments", async () => {
    const app = await buildApp();
    const headers = {
      host: "demo.localhost",
      authorization: `Bearer ${accountantToken(app, { email: "finance@test.com", name: "Finance User" })}`,
    };
    const deleted = await app.inject({
      method: "POST",
      url: "/api/finance/payments/bulk-delete",
      headers,
      payload: { ids: ["pay-1", "pay-2"] },
    });
    expect(deleted.statusCode).toBe(200);
    const restored = await app.inject({
      method: "POST",
      url: "/api/finance/payments/bulk-restore",
      headers,
      payload: { ids: ["pay-1", "pay-2"] },
    });
    expect(restored.statusCode).toBe(200);
    await app.close();
  });

  it("GET /api/finance/report-aggregates loads comparison for authorized roles", async () => {
    mockLoadFinanceReportAggregates.mockResolvedValueOnce({
      comparison: {
        sessions: [{ sessionId: "s1", feeCollected: 150 }],
        monthly: {
          a: [{ monthKey: "2026-01", collected: 50 }],
          b: [{ monthKey: "2026-04", collected: 100 }],
        },
      },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/report-aggregates?sessionIds=s1,s2&rangeAFrom=2026-01-01&rangeATo=2026-03-31&rangeBFrom=2026-04-01&rangeBTo=2026-06-30",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app, { email: "finance@test.com", name: "Finance User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadFinanceReportAggregates).toHaveBeenCalledWith({
      sessionIds: ["s1", "s2"],
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-03-31",
      rangeBFrom: "2026-04-01",
      rangeBTo: "2026-06-30",
    });
    expect(res.json().comparison?.sessions?.[0]?.feeCollected).toBe(150);
    await app.close();
  });

  it("GET /api/finance/report-aggregates returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("finance metrics REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadFinanceCommandMetrics.mockReset().mockResolvedValue({
      totalInvoices: 5,
      outstanding: 2,
      overdue: 1,
      paid: 2,
      partial: 1,
      totalPayments: 3,
      collectedTotal: 500,
      outstandingBalance: 250,
      discountTotal: 50,
      collectedThisMonth: 200,
      collectedPrevMonth: 150,
      outstandingThisMonth: 100,
      outstandingPrevMonth: 75,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/finance/metrics loads SQL metrics for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app, { email: "finance@test.com", name: "Finance User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        totalInvoices: 5,
        outstanding: 2,
        overdue: 1,
        paid: 2,
        partial: 1,
        totalPayments: 3,
        collectedTotal: 500,
        outstandingBalance: 250,
        discountTotal: 50,
        collectedThisMonth: 200,
        collectedPrevMonth: 150,
        outstandingThisMonth: 100,
        outstandingPrevMonth: 75,
      },
    });
    expect(mockLoadFinanceCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/finance/metrics returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/finance/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadFinanceCommandMetrics).not.toHaveBeenCalled();
    await app.close();
  });
});
