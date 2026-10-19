import { describe, expect, it, vi } from "vitest";
import { createFinanceUseCases } from "../finance/use-cases/financeUseCases.js";
import type { FinanceRepository } from "../finance/repository/financeRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

function createFakeRepo(): FinanceRepository {
  return {
    listInvoicesByWorkspace: vi.fn().mockResolvedValue([]),
    findInvoiceById: vi.fn().mockResolvedValue(null),
    findInvoicesByIds: vi.fn().mockResolvedValue([]),
    findInvoiceIdsByEnrollment: async () => [],
    saveInvoice: vi.fn().mockResolvedValue(undefined),
    listInvoicesPage: vi.fn().mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    bulkUpdateInvoicesStatus: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 }),
    bulkSoftDeleteInvoices: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    bulkRestoreInvoices: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    listPaymentsByWorkspace: vi.fn().mockResolvedValue([]),
    findPaymentById: vi.fn().mockResolvedValue(null),
    findPaymentsByIds: vi.fn().mockResolvedValue([]),
    savePayment: vi.fn().mockResolvedValue(undefined),
    bulkSoftDeletePayments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    bulkRestorePayments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    listPaymentsPage: vi.fn().mockResolvedValue({
      payments: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    aggregateFinanceCommandMetrics: vi.fn().mockResolvedValue({
      totalInvoices: 4,
      outstanding: 1,
      overdue: 0,
      paid: 2,
      partial: 1,
      totalPayments: 3,
      collectedTotal: 100,
      outstandingBalance: 50,
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
  };
}

describe("finance use-cases (DI with fake repository)", () => {
  it("loadInvoicesPage delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createFinanceUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadInvoicesPage({ page: 2, limit: 12 }),
    );

    expect(result).toEqual({ invoices: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.listInvoicesPage).toHaveBeenCalledWith("demo", { page: 2, limit: 12 });
  });

  it("loadPaymentsPage delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createFinanceUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadPaymentsPage({ page: 1, limit: 12 }),
    );

    expect(result).toEqual({ payments: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.listPaymentsPage).toHaveBeenCalledWith("demo", { page: 1, limit: 12 });
  });

  it("bulkUpdateInvoicesStatus delegates to the injected repository", async () => {
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

  it("loadFinanceCommandMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createFinanceUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadFinanceCommandMetrics());

    expect(result.totalInvoices).toBe(4);
    expect(repo.aggregateFinanceCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createFinanceUseCases(repo);

    const invoices = await useCases.loadInvoicesPage({ page: 1, limit: 12 });
    const metrics = await useCases.loadFinanceCommandMetrics();

    expect(invoices).toEqual({ invoices: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(metrics.totalInvoices).toBe(0);
    expect(repo.listInvoicesPage).not.toHaveBeenCalled();
    expect(repo.aggregateFinanceCommandMetrics).not.toHaveBeenCalled();
  });

  it("getInvoiceById fetches single invoice and respects soft-delete", async () => {
    const activeInv: any = { id: "inv-1", studentName: "Student 1", deletedAt: null };
    const deletedInv: any = {
      id: "inv-2",
      studentName: "Student 2",
      deletedAt: "2026-08-01T00:00:00.000Z",
    };

    const repo = createFakeRepo();
    (repo.findInvoiceById as any).mockImplementation(async (_tenant: string, id: string) => {
      if (id === "inv-1") return activeInv;
      if (id === "inv-2") return deletedInv;
      return null;
    });
    const useCases = createFinanceUseCases(repo);

    await runWithTenant("demo", async () => {
      const active = await useCases.getInvoiceById("inv-1");
      expect(active).toEqual(activeInv);

      const deletedWithoutFlag = await useCases.getInvoiceById("inv-2");
      expect(deletedWithoutFlag).toBeNull();

      const deletedWithFlag = await useCases.getInvoiceById("inv-2", true);
      expect(deletedWithFlag).toEqual(deletedInv);

      const blankId = await useCases.getInvoiceById("   ");
      expect(blankId).toBeNull();
    });

    const noTenant = await useCases.getInvoiceById("inv-1");
    expect(noTenant).toBeNull();
  });

  it("getInvoicesByIds deduplicates IDs and respects soft-delete", async () => {
    const active1: any = { id: "inv-1", studentName: "Student 1", deletedAt: null };
    const active2: any = { id: "inv-2", studentName: "Student 2", deletedAt: null };
    const deleted: any = {
      id: "inv-3",
      studentName: "Student 3",
      deletedAt: "2026-08-01T00:00:00.000Z",
    };

    const repo = createFakeRepo();
    (repo.findInvoicesByIds as any).mockImplementation(
      (_tenant: string, _ids: string[], options: { includeDeleted?: boolean }) => {
        return Promise.resolve(
          options?.includeDeleted ? [active1, active2, deleted] : [active1, active2],
        );
      },
    );
    const useCases = createFinanceUseCases(repo);

    await runWithTenant("demo", async () => {
      const activeOnly = await useCases.getInvoicesByIds(["inv-1", " inv-2 ", "inv-1", "inv-3"]);
      expect(repo.findInvoicesByIds).toHaveBeenCalledWith("demo", ["inv-1", "inv-2", "inv-3"], {
        includeDeleted: false,
      });
      expect(activeOnly).toEqual([active1, active2]);

      const includingDeleted = await useCases.getInvoicesByIds(["inv-1", "inv-3"], true);
      expect(repo.findInvoicesByIds).toHaveBeenCalledWith("demo", ["inv-1", "inv-3"], {
        includeDeleted: true,
      });
      expect(includingDeleted).toEqual([active1, active2, deleted]);

      const empty = await useCases.getInvoicesByIds([]);
      expect(empty).toEqual([]);
    });

    const noTenant = await useCases.getInvoicesByIds(["inv-1"]);
    expect(noTenant).toEqual([]);
  });

  it("getPaymentById fetches single payment and respects soft-delete", async () => {
    const activePay: any = { id: "pay-1", amount: 100, deletedAt: null };
    const deletedPay: any = { id: "pay-2", amount: 50, deletedAt: "2026-08-01T00:00:00.000Z" };

    const repo = createFakeRepo();
    (repo.findPaymentById as any).mockImplementation(async (_tenant: string, id: string) => {
      if (id === "pay-1") return activePay;
      if (id === "pay-2") return deletedPay;
      return null;
    });
    const useCases = createFinanceUseCases(repo);

    await runWithTenant("demo", async () => {
      const active = await useCases.getPaymentById("pay-1");
      expect(active).toEqual(activePay);

      const deletedWithoutFlag = await useCases.getPaymentById("pay-2");
      expect(deletedWithoutFlag).toBeNull();

      const deletedWithFlag = await useCases.getPaymentById("pay-2", true);
      expect(deletedWithFlag).toEqual(deletedPay);

      const blank = await useCases.getPaymentById("   ");
      expect(blank).toBeNull();
    });

    const noTenant = await useCases.getPaymentById("pay-1");
    expect(noTenant).toBeNull();
  });

  it("getPaymentsByIds deduplicates IDs and respects soft-delete", async () => {
    const active1: any = { id: "pay-1", amount: 100, deletedAt: null };
    const active2: any = { id: "pay-2", amount: 200, deletedAt: null };
    const deleted: any = { id: "pay-3", amount: 50, deletedAt: "2026-08-01T00:00:00.000Z" };

    const repo = createFakeRepo();
    (repo.findPaymentsByIds as any).mockImplementation(
      (_tenant: string, _ids: string[], options: { includeDeleted?: boolean }) => {
        return Promise.resolve(
          options?.includeDeleted ? [active1, active2, deleted] : [active1, active2],
        );
      },
    );
    const useCases = createFinanceUseCases(repo);

    await runWithTenant("demo", async () => {
      const activeOnly = await useCases.getPaymentsByIds(["pay-1", " pay-2 ", "pay-1", "pay-3"]);
      expect(repo.findPaymentsByIds).toHaveBeenCalledWith("demo", ["pay-1", "pay-2", "pay-3"], {
        includeDeleted: false,
      });
      expect(activeOnly).toEqual([active1, active2]);

      const includingDeleted = await useCases.getPaymentsByIds(["pay-1", "pay-3"], true);
      expect(repo.findPaymentsByIds).toHaveBeenCalledWith("demo", ["pay-1", "pay-3"], {
        includeDeleted: true,
      });
      expect(includingDeleted).toEqual([active1, active2, deleted]);

      const empty = await useCases.getPaymentsByIds([]);
      expect(empty).toEqual([]);
    });

    const noTenant = await useCases.getPaymentsByIds(["pay-1"]);
    expect(noTenant).toEqual([]);
  });
});
