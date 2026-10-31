import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFinanceUseCases } from "../finance/use-cases/financeUseCases.js";
import type { FinanceRepository } from "../finance/repository/financeRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * The ledger guard reads the stored invoice and the posting id through the
 * injected repository seam, so no module-level adapter needs stubbing.
 */
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
    bulkUpdateInvoicesStatus: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 }),
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

const storedInvoice = {
  id: "inv-1",
  studentId: "stu-1",
  status: "pending",
  baseFee: 100,
  discountAmt: 0,
  finalAmt: 100,
  paidAmt: 0,
  lateFeeAmt: 0,
  creditedAmt: 0,
  dueDate: "2026-06-01",
  lines: [],
};

/** Repository whose invoice is readable and (by default) posted to the ledger. */
function postedRepo(postingId: string | null = "je-invoice") {
  const repo = createFakeRepo();
  vi.mocked(repo.findInvoiceById).mockResolvedValue(storedInvoice as never);
  vi.mocked(repo.findLedgerPostingIdBySource).mockResolvedValue(postingId);
  return repo;
}

describe("finance ↔ ledger sync guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bulkUpdateInvoicesStatus", () => {
    it("refuses to cancel invoices in bulk, which would skip the ledger reversal", async () => {
      const repo = createFakeRepo();
      const useCases = createFinanceUseCases(repo);

      await expect(
        runWithTenant("demo", () => useCases.bulkUpdateInvoicesStatus(["inv-1"], "cancelled")),
      ).rejects.toThrow(/cancel-invoice action/);
      expect(repo.bulkUpdateInvoicesStatus).not.toHaveBeenCalled();
    });

    it("refuses to mark invoices paid in bulk, which would post no payment", async () => {
      const repo = createFakeRepo();
      const useCases = createFinanceUseCases(repo);

      await expect(
        runWithTenant("demo", () => useCases.bulkUpdateInvoicesStatus(["inv-1"], "paid")),
      ).rejects.toThrow(/Record a payment/);
      expect(repo.bulkUpdateInvoicesStatus).not.toHaveBeenCalled();
    });

    it("still allows ledger-neutral statuses", async () => {
      const repo = createFakeRepo();
      const useCases = createFinanceUseCases(repo);

      const result = await runWithTenant("demo", () =>
        useCases.bulkUpdateInvoicesStatus(["inv-1", "inv-2"], "overdue"),
      );

      expect(result).toEqual({ succeeded: 2, failed: 0 });
      expect(repo.bulkUpdateInvoicesStatus).toHaveBeenCalledWith(
        "demo",
        ["inv-1", "inv-2"],
        "overdue",
      );
    });
  });

  describe("updateInvoiceById", () => {
    it("rejects editing a posted invoice amount", async () => {
      const repo = postedRepo();

      await expect(
        runWithTenant("demo", () =>
          useCasesFor(repo).updateInvoiceById("inv-1", { finalAmt: 250 } as never),
        ),
      ).rejects.toThrow(/reverse it with a credit note/);
      expect(repo.saveInvoice).not.toHaveBeenCalled();
    });

    it("rejects a late-fee or paid-amount edit on a posted invoice", async () => {
      const repo = postedRepo();
      const useCases = useCasesFor(repo);

      await expect(
        runWithTenant("demo", () =>
          useCases.updateInvoiceById("inv-1", { lateFeeAmt: 40 } as never),
        ),
      ).rejects.toThrow(/lateFeeAmt/);
      await expect(
        runWithTenant("demo", () => useCases.updateInvoiceById("inv-1", { paidAmt: 100 } as never)),
      ).rejects.toThrow(/paidAmt/);
    });

    it("rejects a cancel or paid status write on a posted invoice", async () => {
      const repo = postedRepo();
      const useCases = useCasesFor(repo);

      await expect(
        runWithTenant("demo", () =>
          useCases.updateInvoiceById("inv-1", { status: "cancelled" } as never),
        ),
      ).rejects.toThrow(/cancel-invoice action/);
      await expect(
        runWithTenant("demo", () =>
          useCases.updateInvoiceById("inv-1", { status: "paid" } as never),
        ),
      ).rejects.toThrow(/record a payment/i);
      expect(repo.saveInvoice).not.toHaveBeenCalled();
    });

    it("rejects a credited-amount write on a posted invoice", async () => {
      const repo = postedRepo();
      const useCases = useCasesFor(repo);

      await expect(
        runWithTenant("demo", () =>
          useCases.updateInvoiceById("inv-1", { creditedAmt: 50 } as never),
        ),
      ).rejects.toThrow(/creditedAmt/);
      expect(repo.saveInvoice).not.toHaveBeenCalled();
    });

    it("allows a non-financial edit on a posted invoice", async () => {
      const repo = postedRepo();

      await runWithTenant("demo", () =>
        useCasesFor(repo).updateInvoiceById("inv-1", { status: "partial" } as never),
      );

      expect(repo.saveInvoice).toHaveBeenCalled();
    });

    it("allows a client that echoes the unchanged amounts back", async () => {
      // The UI sends the whole invoice on any edit; only real differences block.
      const repo = postedRepo();
      const useCases = useCasesFor(repo);

      await runWithTenant("demo", () =>
        useCases.updateInvoiceById("inv-1", {
          baseFee: 100,
          discountAmt: 0,
          finalAmt: 100,
          paidAmt: 0,
          lateFeeAmt: 0,
          creditedAmt: 0,
          status: "overdue",
        } as never),
      );

      expect(repo.saveInvoice).toHaveBeenCalled();
    });

    it("allows amount edits when the invoice was never posted", async () => {
      // Workspaces without posting rules keep full editing freedom.
      const repo = postedRepo(null);

      await runWithTenant("demo", () =>
        useCasesFor(repo).updateInvoiceById("inv-1", { finalAmt: 250 } as never),
      );

      expect(repo.saveInvoice).toHaveBeenCalled();
    });

    it("keeps the internal cancel/credit escape hatch", async () => {
      // cancelInvoice and createCreditNote pass this flag after their own
      // canCancel/canCredit checks and post the reversal themselves.
      const repo = postedRepo();

      await runWithTenant("demo", () =>
        useCasesFor(repo).updateInvoiceById("inv-1", { status: "cancelled" } as never, {
          allowLedgerSensitive: true,
        }),
      );

      expect(repo.saveInvoice).toHaveBeenCalled();
    });
  });
});

function useCasesFor(repo: FinanceRepository) {
  return createFinanceUseCases(repo);
}
