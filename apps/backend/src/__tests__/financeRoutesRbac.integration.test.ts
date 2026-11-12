import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, auditorToken, teacherToken } from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, work: () => unknown) => work(),
  withTenantRead: (_tenant: string, work: () => unknown) => work(),
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

const mockCreateInvoice = vi.fn();
const mockCreatePayment = vi.fn();
const mockDeleteInvoice = vi.fn();

vi.mock("../finance/use-cases/financeUseCases.js", () => ({
  financeUseCases: {
    loadInvoices: vi.fn().mockResolvedValue([]),
    loadInvoicesPage: vi.fn().mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    }),
    loadPayments: vi.fn().mockResolvedValue([]),
    loadPaymentsPage: vi.fn().mockResolvedValue({
      payments: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    }),
    createInvoice: (...args: unknown[]) => mockCreateInvoice(...args),
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
    deleteInvoiceById: (...args: unknown[]) => mockDeleteInvoice(...args),
    updateInvoiceById: vi.fn(),
    updatePaymentById: vi.fn(),
    deletePaymentById: vi.fn(),
    restoreInvoiceById: vi.fn(),
    restorePaymentById: vi.fn(),
    bulkSoftDeleteInvoices: vi.fn(),
    bulkRestoreInvoices: vi.fn(),
    bulkSoftDeletePayments: vi.fn(),
    bulkRestorePayments: vi.fn(),
    bulkUpdateInvoicesStatus: vi.fn(),
    getInvoiceById: vi.fn(),
    getPaymentById: vi.fn(),
    loadFinanceReportAggregates: vi.fn().mockResolvedValue({ comparison: null }),
    loadFinanceCommandMetrics: vi.fn().mockResolvedValue({}),
    loadFinanceWidgetAggregates: vi.fn().mockResolvedValue({}),
  },
}));

const INVOICE_BODY = {
  studentId: "stu-1",
  studentName: "Student",
  class: "Hifz",
  session: "2026",
  baseFee: 100,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 100,
  status: "pending",
  dueDate: "2026-11-30",
};

const PAYMENT_BODY = {
  invoiceId: "inv-1",
  studentId: "stu-1",
  studentName: "Student",
  amount: 50,
  date: "2026-11-05",
  method: "Cash",
};

function injectAs(
  app: Awaited<ReturnType<typeof buildApp>>,
  token: string,
  url: string,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: "POST",
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
    payload: body as never,
  });
}

describe("finance write routes enforce the capability matrix", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockCreateInvoice.mockReset().mockResolvedValue({
      id: "inv-new",
      studentId: "stu-1",
      studentName: "Student",
      class: "Hifz",
      session: "2026",
      baseFee: 100,
      discountValue: 0,
      discountAmt: 0,
      finalAmt: 100,
      status: "pending",
      dueDate: "2026-11-30",
    });
    mockCreatePayment.mockReset().mockResolvedValue({
      id: "pay-new",
      invoiceId: "inv-1",
      studentId: "stu-1",
      studentName: "Student",
      amount: 50,
      date: "2026-11-05",
      method: "Cash",
    });
    mockDeleteInvoice.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires authentication for invoice creation", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/finance/invoices",
      headers: { host: "demo.localhost" },
      payload: INVOICE_BODY,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("refuses invoice creation to a teacher", async () => {
    const app = await buildApp();
    const res = await injectAs(app, teacherToken(app), "/api/finance/invoices", INVOICE_BODY);
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("refuses invoice creation to a read-only auditor", async () => {
    const app = await buildApp();
    const res = await injectAs(app, auditorToken(app), "/api/finance/invoices", INVOICE_BODY);
    expect(res.statusCode).toBe(403);
    expect(mockCreateInvoice).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets the accountant create an invoice and a payment", async () => {
    const app = await buildApp();
    const token = accountantToken(app);
    const invoice = await injectAs(app, token, "/api/finance/invoices", INVOICE_BODY);
    expect(invoice.statusCode).toBe(201);
    expect(mockCreateInvoice).toHaveBeenCalledTimes(1);

    const payment = await injectAs(app, token, "/api/finance/payments", PAYMENT_BODY);
    expect(payment.statusCode).toBe(201);
    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("refuses payment creation to a teacher", async () => {
    const app = await buildApp();
    const res = await injectAs(app, teacherToken(app), "/api/finance/payments", PAYMENT_BODY);
    expect(res.statusCode).toBe(403);
    expect(mockCreatePayment).not.toHaveBeenCalled();
    await app.close();
  });

  it("refuses overdue collection and reminders to read-only roles", async () => {
    const app = await buildApp();
    for (const token of [teacherToken(app), auditorToken(app)]) {
      const collect = await injectAs(app, token, "/api/finance/invoices/collect", {});
      expect(collect.statusCode).toBe(403);
      const remind = await injectAs(app, token, "/api/finance/invoices/remind", {});
      expect(remind.statusCode).toBe(403);
      const generate = await injectAs(app, token, "/api/finance/invoices/generate", {
        billingPeriod: "2026-11",
      });
      expect(generate.statusCode).toBe(403);
    }
    await app.close();
  });

  it("refuses invoice deletion to a read-only auditor", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/finance/invoices/inv-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${auditorToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockDeleteInvoice).not.toHaveBeenCalled();
    await app.close();
  });
});
