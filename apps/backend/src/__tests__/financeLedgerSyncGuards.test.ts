import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFinanceUseCases } from "../finance/use-cases/financeUseCases.js";
import type { FinanceRepository } from "../finance/repository/financeRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * `assertInvoiceAmountsEditable` reads the stored invoice through the module-level
 * adapter and the ledger through the accounting repository, so both seams are
 * stubbed here.
 */
const mockAccountingRepo = vi.hoisted(() => ({ findEntryIdBySource: vi.fn() }));
const mockInvoiceLookup = vi.hoisted(() => ({ findInvoiceById: vi.fn() }));
const mockRecordModernAuditEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mockRecordModernAuditEvent,
}));

vi.mock("../db/repositories/accountingRepository.js", () => mockAccountingRepo);
vi.mock("../finance/repository/financeRepositoryAdapter.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../finance/repository/financeRepositoryAdapter.js")>();
  return {
    ...actual,
    financeRepository: {
      ...actual.financeRepository,
      findInvoiceById: mockInvoiceLookup.findInvoiceById,
    },
  };
});

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

describe("finance ↔ ledger sync guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoiceLookup.findInvoiceById.mockResolvedValue(storedInvoice);
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
  });

  describe("bulkUpdateInvoicesStatus", () => {
    it("refuses to cancel invoices in bulk, which would skip the ledger reversal", async () => {
      // This endpoint used to accept 'cancelled' and write a bare status, leaving
      // the Dr AR / Cr Income entry posted forever while the invoice read
      // 'cancelled'.
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
      // Nothing re-posted the difference, so the ledger mirrored the original
      // figure forever and AR/revenue silently disagreed with the document.
      mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-invoice");
      const repo = createFakeRepo();
      const useCases = createFinanceUseCases(repo);

      await expect(
        runWithTenant("demo", () => useCases.updateInvoiceById("inv-1", { finalAmt: 250 } as any)),
      ).rejects.toThrow(/reverse it with a credit note/);
      expect(repo.saveInvoice).not.toHaveBeenCalled();
    });

    it("rejects a late-fee or paid-amount edit on a posted invoice", async () => {
      mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-invoice");
      const useCases = createFinanceUseCases(createFakeRepo());

      await expect(
        runWithTenant("demo", () => useCases.updateInvoiceById("inv-1", { lateFeeAmt: 40 } as any)),
      ).rejects.toThrow(/lateFeeAmt/);
      await expect(
        runWithTenant("demo", () => useCases.updateInvoiceById("inv-1", { paidAmt: 100 } as any)),
      ).rejects.toThrow(/paidAmt/);
    });

    it("allows a non-financial edit on a posted invoice", async () => {
      mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-invoice");
      const repo = createFakeRepo();
      vi.mocked(repo.findInvoiceById).mockResolvedValue(storedInvoice as any);
      const useCases = createFinanceUseCases(repo);

      await runWithTenant("demo", () =>
        useCases.updateInvoiceById("inv-1", { status: "partial" } as any),
      );

      expect(repo.saveInvoice).toHaveBeenCalled();
    });

    it("allows a client that echoes the unchanged amounts back", async () => {
      // The UI sends the whole invoice on any edit; only real differences block.
      mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-invoice");
      const repo = createFakeRepo();
      vi.mocked(repo.findInvoiceById).mockResolvedValue(storedInvoice as any);
      const useCases = createFinanceUseCases(repo);

      await runWithTenant("demo", () =>
        useCases.updateInvoiceById("inv-1", {
          baseFee: 100,
          discountAmt: 0,
          finalAmt: 100,
          paidAmt: 0,
          lateFeeAmt: 0,
          status: "overdue",
        } as any),
      );

      expect(repo.saveInvoice).toHaveBeenCalled();
    });

    it("allows amount edits when the invoice was never posted", async () => {
      // Workspaces without posting rules keep full editing freedom.
      mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
      const repo = createFakeRepo();
      vi.mocked(repo.findInvoiceById).mockResolvedValue(storedInvoice as any);
      const useCases = createFinanceUseCases(repo);

      await runWithTenant("demo", () =>
        useCases.updateInvoiceById("inv-1", { finalAmt: 250 } as any),
      );

      expect(repo.saveInvoice).toHaveBeenCalled();
    });
  });
});
