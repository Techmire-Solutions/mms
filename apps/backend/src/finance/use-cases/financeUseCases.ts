import type { FinanceRepository } from "../repository/financeRepository.js";
import { financeRepository } from "../repository/financeRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { invoiceRecordSchema, paymentRecordSchema } from "@mms/shared";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import {
  dedupeTrimmedIds,
  normalizeFinanceReportComparisonQuery,
  type FinanceCommandMetricsSnapshot,
  type FinanceListQuery,
  type FinanceReportComparisonQuery,
  type Invoice,
  type Payment,
  type PaymentUpdate,
} from "@mms/shared";
import { createFinanceLifecycleOperations } from "./financeRecordLifecycle.js";
import { createFinanceMutationOperations } from "./financeMutationOperations.js";

const EMPTY_FINANCE_METRICS: FinanceCommandMetricsSnapshot = {
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
};

function requireRequestTenant(): string {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}

/**
 * Finance use-cases — composition root binding a {@link FinanceRepository} to
 * every operation. Production uses the default Drizzle-backed `financeUseCases`;
 * tests can pass a fake repository to exercise orchestration in isolation.
 */
export function createFinanceUseCases(repo: FinanceRepository = financeRepository) {
  const invoiceCrud = createGenericRelationalService<Invoice>({
    repo: {
      listByWorkspace: repo.listInvoicesByWorkspace,
      findById: repo.findInvoiceById,
      save: repo.saveInvoice,
      bulkDelete: repo.bulkSoftDeleteInvoices,
      bulkRestore: repo.bulkRestoreInvoices,
    },
    schema: invoiceRecordSchema,
    websocketCollection: "finance_invoices",
    idPrefix: "inv",
  });

  const paymentCrud = createGenericRelationalService<Payment>({
    repo: {
      listByWorkspace: repo.listPaymentsByWorkspace,
      findById: repo.findPaymentById,
      save: repo.savePayment,
      bulkDelete: repo.bulkSoftDeletePayments,
      bulkRestore: repo.bulkRestorePayments,
    },
    schema: paymentRecordSchema,
    websocketCollection: "finance_payments",
    idPrefix: "pay",
  });

  /**
   * Archive / restore carry ledger and invoice-balance consequences, so they
   * are composed here rather than exposing the bare soft delete.
   */
  const lifecycle = createFinanceLifecycleOperations({
    repo,
    invoiceCrud,
    paymentCrud,
    requireTenant: requireRequestTenant,
  });

  const mutations = createFinanceMutationOperations({
    repo,
    invoiceCrud,
    requireTenant: requireRequestTenant,
  });

  return {
    // --- Invoices ---
    loadInvoices: invoiceCrud.loadAll,
    createInvoice: mutations.createInvoice,
    updateInvoiceById: mutations.updateInvoiceById,
    deleteInvoiceById: lifecycle.deleteInvoiceById,
    restoreInvoiceById: lifecycle.restoreInvoiceById,
    bulkSoftDeleteInvoices: lifecycle.bulkSoftDeleteInvoices,
    bulkRestoreInvoices: lifecycle.bulkRestoreInvoices,

    getInvoiceById: async (id: string, includeDeleted = false): Promise<Invoice | null> => {
      const tenant = getRequestTenant();
      if (!tenant) return null;
      const cleanId = id?.trim();
      if (!cleanId) return null;
      const invoice = await repo.findInvoiceById(tenant, cleanId);
      if (!invoice) return null;
      if (!includeDeleted && invoice.deletedAt) return null;
      return invoice;
    },

    getInvoicesByIds: async (ids: string[], includeDeleted = false): Promise<Invoice[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findInvoicesByIds(tenant, cleanIds, { includeDeleted });
    },

    bulkUpdateInvoicesStatus: mutations.bulkUpdateInvoicesStatus,

    loadInvoicesPage: async (query: FinanceListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          invoices: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listInvoicesPage(tenant, query);
    },

    // --- Payments ---
    loadPayments: paymentCrud.loadAll,
    updatePaymentById: async (id: string, record: PaymentUpdate): Promise<Payment | null> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const { allocations: rawAllocations, ...rest } = record;
      const allocations = rawAllocations
        ? (rawAllocations.map((alloc, index) => ({
            ...alloc,
            id: alloc.id ?? `pa-${index + 1}`,
          })) as Payment["allocations"])
        : undefined;
      return paymentCrud.updateById(id, {
        ...rest,
        ...(allocations ? { allocations } : {}),
      });
    },
    deletePaymentById: lifecycle.deletePaymentById,
    restorePaymentById: lifecycle.restorePaymentById,
    bulkSoftDeletePayments: lifecycle.bulkSoftDeletePayments,
    bulkRestorePayments: lifecycle.bulkRestorePayments,

    getPaymentById: async (id: string, includeDeleted = false): Promise<Payment | null> => {
      const tenant = getRequestTenant();
      if (!tenant) return null;
      const cleanId = id?.trim();
      if (!cleanId) return null;
      const payment = await repo.findPaymentById(tenant, cleanId);
      if (!payment) return null;
      if (!includeDeleted && payment.deletedAt) return null;
      return payment;
    },

    getPaymentsByIds: async (ids: string[], includeDeleted = false): Promise<Payment[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findPaymentsByIds(tenant, cleanIds, { includeDeleted });
    },

    loadPaymentsPage: async (query: FinanceListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          payments: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listPaymentsPage(tenant, query);
    },

    createPayment: mutations.createPayment,

    // --- Aggregates ---
    loadFinanceReportAggregates: async (comparisonQuery?: FinanceReportComparisonQuery) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return { comparison: { sessions: [], monthly: { a: [], b: [] } } };
      }
      const normalized = normalizeFinanceReportComparisonQuery(comparisonQuery);
      return repo.loadFinanceReportAggregates(tenant, normalized);
    },

    loadFinanceCommandMetrics: async (): Promise<FinanceCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_FINANCE_METRICS;
      return repo.aggregateFinanceCommandMetrics(tenant);
    },

    loadFinanceWidgetAggregates: async (
      queries: import("@mms/shared").WidgetQuery[],
    ): Promise<Record<string, import("@mms/shared").WidgetAggregateResult>> => {
      const tenant = getRequestTenant();
      if (!tenant) return {};
      return repo.aggregateFinanceWidgetQueries(tenant, queries);
    },
  };
}

export const financeUseCases = createFinanceUseCases();
