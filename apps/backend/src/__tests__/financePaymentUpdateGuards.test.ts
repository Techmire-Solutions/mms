import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFinanceUseCases } from "../finance/use-cases/financeUseCases.js";
import type { FinanceRepository } from "../finance/repository/financeRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const mockRecordModernAuditEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mockRecordModernAuditEvent,
}));

function createFakeRepo(): FinanceRepository {
  return {
    listInvoicesByWorkspace: vi.fn().mockResolvedValue([]),
    findInvoiceById: vi.fn().mockResolvedValue(null),
    findInvoicesByIds: vi.fn().mockResolvedValue([]),
    findInvoiceIdsByEnrollment: async () => [],
    saveInvoice: vi.fn().mockResolvedValue(undefined),
    listInvoicesPage: vi
      .fn()
      .mockResolvedValue({ invoices: [], total: 0, page: 1, limit: 12, hasMore: false }),
    bulkUpdateInvoicesStatus: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    bulkSoftDeleteInvoices: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    bulkRestoreInvoices: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    listPaymentsByWorkspace: vi.fn().mockResolvedValue([]),
    findPaymentById: vi.fn().mockResolvedValue(null),
    findPaymentsByIds: vi.fn().mockResolvedValue([]),
    savePayment: vi.fn().mockResolvedValue(undefined),
    bulkSoftDeletePayments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    bulkRestorePayments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    listPaymentsPage: vi
      .fn()
      .mockResolvedValue({ payments: [], total: 0, page: 1, limit: 12, hasMore: false }),
    findLedgerPostingIdBySource: vi.fn().mockResolvedValue(null),
    aggregateFinanceCommandMetrics: vi.fn().mockResolvedValue({
      totalInvoices: 0,
      outstanding: 0,
      overdue: 0,
      paid: 0,
      partial: 0,
      totalPayments: 0,
      collectedTotal: 0,
      outstandingBalance: 0,
      discountTotal: 0,
      collectedThisMonth: 0,
      collectedPrevMonth: 0,
      outstandingThisMonth: 0,
      outstandingPrevMonth: 0,
    }),
    aggregateFinanceWidgetQueries: vi.fn().mockResolvedValue({}),
    loadFinanceReportAggregates: vi.fn().mockResolvedValue({
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    }),
  } as unknown as FinanceRepository;
}

const storedPayment = {
  id: "pay-1",
  invoiceId: "inv-1",
  studentId: "stu-1",
  studentName: "Ahmad",
  amount: 100,
  date: "2026-01-15",
  method: "cash",
  note: "",
  currency: "PKR",
  exchangeRate: "1",
  invoiceAmount: 100,
  allocations: [{ id: "pa-1", invoiceId: "inv-1", amount: 100 }],
  deletedAt: null,
};

function repoWithPayment(postingId: string | null) {
  const repo = createFakeRepo();
  vi.mocked(repo.findPaymentById).mockResolvedValue(storedPayment as never);
  vi.mocked(repo.findLedgerPostingIdBySource).mockResolvedValue(postingId);
  return repo;
}

describe("finance payment update guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an amount edit on a posted payment", async () => {
    const repo = repoWithPayment("je-payment");

    await expect(
      runWithTenant("demo", () =>
        createFinanceUseCases(repo).updatePaymentById("pay-1", { amount: 999 }),
      ),
    ).rejects.toThrow(/archive it and re-enter the payment/);
    expect(repo.savePayment).not.toHaveBeenCalled();
  });

  it("rejects invoice, date, FX rate and allocation edits on a posted payment", async () => {
    const repo = repoWithPayment("je-payment");
    const useCases = createFinanceUseCases(repo);

    for (const patch of [
      { invoiceId: "inv-2" },
      { date: "2026-02-01" },
      { exchangeRate: 2 },
      { allocations: [{ invoiceId: "inv-1", amount: 40 }] },
    ]) {
      await expect(
        runWithTenant("demo", () => useCases.updatePaymentById("pay-1", patch as never)),
      ).rejects.toThrow(/posted to the ledger/);
    }
    expect(repo.savePayment).not.toHaveBeenCalled();
  });

  it("allows a metadata edit on a posted payment and audits the old state", async () => {
    const repo = repoWithPayment("je-payment");

    await runWithTenant("demo", () =>
      createFinanceUseCases(repo).updatePaymentById("pay-1", { note: "bank transfer" }),
    );

    expect(repo.savePayment).toHaveBeenCalledTimes(1);
    expect(mockRecordModernAuditEvent).toHaveBeenCalledTimes(1);
    const event = mockRecordModernAuditEvent.mock.calls[0]?.[0] as {
      actionType: string;
      oldState?: { note?: string; amount?: number };
      newState: { amount: number };
    };
    expect(event.actionType).toBe("UPDATE");
    expect(event.oldState).toBeDefined();
    expect(event.newState.amount).toBe(100);
  });

  it("allows financial edits while the payment is not posted, with an UPDATE audit", async () => {
    const repo = repoWithPayment(null);

    await runWithTenant("demo", () =>
      createFinanceUseCases(repo).updatePaymentById("pay-1", { amount: 150 }),
    );

    expect(repo.savePayment).toHaveBeenCalledTimes(1);
    expect(mockRecordModernAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("treats an echoed unchanged amount as a no-op, not an edit", async () => {
    const repo = repoWithPayment("je-payment");

    await runWithTenant("demo", () =>
      createFinanceUseCases(repo).updatePaymentById("pay-1", {
        amount: 100,
        invoiceId: "inv-1",
        date: "2026-01-15",
      }),
    );

    expect(repo.savePayment).toHaveBeenCalledTimes(1);
  });

  it("returns null for a missing or archived payment without writing", async () => {
    const repo = createFakeRepo();
    const useCases = createFinanceUseCases(repo);

    await runWithTenant("demo", async () => {
      await expect(useCases.updatePaymentById("missing", { note: "x" })).resolves.toBeNull();
    });

    vi.mocked(repo.findPaymentById).mockResolvedValue({
      ...storedPayment,
      deletedAt: "2026-02-01T00:00:00.000Z",
    } as never);
    await runWithTenant("demo", async () => {
      await expect(useCases.updatePaymentById("pay-1", { note: "x" })).resolves.toBeNull();
    });

    expect(repo.savePayment).not.toHaveBeenCalled();
  });
});
