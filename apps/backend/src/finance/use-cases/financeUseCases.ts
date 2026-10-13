import type { FinanceRepository } from "../repository/financeRepository.js";
import { financeRepository } from "../repository/financeRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { invoiceRecordSchema, paymentRecordSchema } from "@mms/shared";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { runInTransaction } from "../../db/database.js";
import {
  dedupeTrimmedIds,
  getOutstandingAmountForInvoice,
  invoiceTotalsFromLines,
  normalizeFinanceReportComparisonQuery,
  resolveFamilyContactId,
  type FinanceCommandMetricsSnapshot,
  type FinanceListQuery,
  type FinanceReportComparisonQuery,
  type Invoice,
  type InvoiceCreateInput,
  type InvoiceUpdate,
  type Payment,
  type PaymentCreateInput,
  type PaymentUpdate,
} from "@mms/shared";
import {
  allocateNextInvoiceNumber,
  replacePaymentAllocations,
} from "../../db/repositories/financeBillingRepository.js";
import { createFinanceLifecycleOperations } from "./financeRecordLifecycle.js";
import {
  tryPostInvoiceJournal,
  tryPostPaymentJournal,
} from "../../accounting/ledgerPosting/ledgerPostingService.js";
import { findEntryIdBySource } from "../../db/repositories/accountingRepository.js";
import { loadFinanceModulePreferences } from "../../services/financePreferencesService.js";

/**
 * Money fields whose change would invalidate an invoice's already-posted ledger
 * entry: `finalAmt`/`discountAmt` drive the Dr AR / Cr Income posting, and
 * `lateFeeAmt` / `paidAmt` each have their own posting. Line edits are covered
 * transitively because they recompute the totals.
 */
const LEDGER_SENSITIVE_INVOICE_AMOUNTS = [
  "finalAmt",
  "discountAmt",
  "lateFeeAmt",
  "paidAmt",
] as const satisfies readonly (keyof Invoice)[];

/** Invoice statuses that imply a ledger posting and may not be set by a bulk write. */
const LEDGER_AFFECTING_INVOICE_STATUSES = new Set(["cancelled", "paid"]);

/**
 * An invoice that already has a ledger entry may not have its amounts edited in
 * place.
 *
 * Nothing re-posted the difference, so a corrected amount left the ledger
 * mirroring the original figure forever — the receivable and revenue silently
 * disagreed with the invoice document, with no error and no repost path. Once
 * posting is configured, the accounting remedy is a credit note or an adjusting
 * entry. Workspaces with no posting rules are unaffected because no entry exists.
 *
 * Only values that actually differ are rejected, so a client that sends the whole
 * invoice back on an unrelated edit is not blocked.
 */
async function assertInvoiceAmountsEditable(
  tenant: string,
  invoiceId: string,
  incoming: Partial<Invoice>,
): Promise<void> {
  const touched = LEDGER_SENSITIVE_INVOICE_AMOUNTS.filter((field) => incoming[field] !== undefined);
  if (touched.length === 0) return;

  const existing = await financeRepository.findInvoiceById(tenant, invoiceId);
  if (!existing) return;

  const changed = touched.filter(
    (field) => Number(incoming[field] ?? 0) !== Number(existing[field] ?? 0),
  );
  if (changed.length === 0) return;

  const ledgerEntryId = await findEntryIdBySource(tenant, "invoice", invoiceId);
  if (!ledgerEntryId) return;

  throw Object.assign(
    new Error(
      `This invoice is posted to the ledger — reverse it with a credit note or adjusting entry instead of editing ${changed.join(", ")}`,
    ),
    { statusCode: 422, type: "validation_error" },
  );
}

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

  return {
    // --- Invoices ---
    loadInvoices: invoiceCrud.loadAll,
    createInvoice: async (record: InvoiceCreateInput): Promise<Invoice> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const year = Number((record.dueDate ?? "").slice(0, 4)) || new Date().getFullYear();
      let prefix = "INV";
      try {
        const prefs = await loadFinanceModulePreferences();
        prefix = prefs?.invoicePrefix?.trim() || "INV";
      } catch {
        // Keep default prefix when preferences are unavailable.
      }
      const lines = (record.lines ?? []).map((line, index) => ({
        ...line,
        id: line.id ?? `il-${index + 1}`,
      }));
      const totals = lines.length > 0 ? invoiceTotalsFromLines(lines) : null;
      const { findStudentsByIds } = await import("../../db/repositories/studentRepository.js");
      const students = record.studentId ? await findStudentsByIds(tenant, [record.studentId]) : [];
      if (record.studentId && (!students[0] || students[0].deletedAt)) {
        const err = new Error("Referenced student is archived or does not exist");
        (err as Error & { statusCode: number }).statusCode = 400;
        throw err;
      }
      const created = await invoiceCrud.create({
        ...record,
        studentId: students[0]?.id ?? record.studentId,
        familyContactId: record.familyContactId ?? resolveFamilyContactId(students[0]),
        invoiceNumber:
          record.invoiceNumber || (await allocateNextInvoiceNumber(tenant, year, prefix)),
        ...(totals
          ? { baseFee: totals.baseFee, discountAmt: totals.discountAmt, finalAmt: totals.finalAmt }
          : {}),
        ...(lines.length > 0 ? { lines } : {}),
      } as Invoice);
      await tryPostInvoiceJournal(tenant, created);
      return created;
    },
    updateInvoiceById: async (id: string, record: InvoiceUpdate): Promise<Invoice | null> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      let resolvedStudentId = record.studentId;
      if (record.studentId) {
        const { findStudentsByIds } = await import("../../db/repositories/studentRepository.js");
        const students = await findStudentsByIds(tenant, [record.studentId]);
        if (!students[0] || students[0].deletedAt) {
          const err = new Error("Referenced student is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
        resolvedStudentId = students[0].id;
      }
      const { lines: rawLines, ...rest } = record;
      const lines = rawLines
        ? (rawLines.map((line, index) => ({
            ...line,
            id: line.id ?? `il-${index + 1}`,
          })) as Invoice["lines"])
        : undefined;
      await assertInvoiceAmountsEditable(tenant, id, rest);
      return invoiceCrud.updateById(id, {
        ...rest,
        ...(resolvedStudentId ? { studentId: resolvedStudentId } : {}),
        ...(lines ? { lines } : {}),
      });
    },
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

    bulkUpdateInvoicesStatus: async (
      ids: string[],
      status: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant) return { succeeded: 0, failed: cleanIds.length };
      if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };
      // Defence in depth: `invoicesBulkStatusSchema` already narrows the enum, but
      // this use case is directly callable and a bare status write posts nothing
      // to the ledger. Cancelling here left the Dr AR / Cr Income entry on the
      // books forever while the invoice read 'cancelled'; marking 'paid' marked
      // an invoice settled with no payment posting.
      if (LEDGER_AFFECTING_INVOICE_STATUSES.has(status)) {
        throw Object.assign(
          new Error(
            status === "cancelled"
              ? "Cancel invoices through the cancel-invoice action so the ledger reversal is posted"
              : "Record a payment to mark invoices paid — a bulk status write posts nothing to the ledger",
          ),
          { statusCode: 422, type: "validation_error" },
        );
      }
      const result = await repo.bulkUpdateInvoicesStatus(tenant, cleanIds, status);
      const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
      broadcastTenantUpdate(tenant, "collection", "finance_invoices");
      broadcastTenantUpdate(tenant, "collection", "finance_metrics");
      return result;
    },

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

    /**
     * Creates a payment and atomically updates the linked invoice's payment details.
     */
    createPayment: async (record: PaymentCreateInput): Promise<Payment> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const resolvedId = String(record.id ?? `pay-${Date.now()}`);
      const normalizedPayment = paymentRecordSchema.parse({ ...record, id: resolvedId }) as Payment;

      const savedPayment = await runInTransaction(async () => {
        const existingPayment = await repo.findPaymentById(tenant, resolvedId);
        if (existingPayment) return existingPayment;

        const invoice = await repo.findInvoiceById(tenant, normalizedPayment.invoiceId);
        if (!invoice || invoice.deletedAt) {
          const err = new Error("Referenced invoice is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }

        const paidAmount = invoice.paidAmt ?? 0;
        const remainingBalance = getOutstandingAmountForInvoice(invoice);
        if (normalizedPayment.amount > remainingBalance) {
          throw new Error("Payment amount exceeds the remaining invoice balance");
        }

        const newPaid = paidAmount + normalizedPayment.amount;
        await repo.saveInvoice(tenant, {
          ...invoice,
          status: remainingBalance - normalizedPayment.amount <= 0 ? "paid" : "partial",
          paidAmt: newPaid,
          paidDate: normalizedPayment.date,
          method: normalizedPayment.method,
        });
        await repo.savePayment(tenant, normalizedPayment);
        return normalizedPayment;
      });

      const allocations = (record.allocations ?? []).map((allocation, index) => ({
        ...allocation,
        id: allocation.id ?? `alloc-${index + 1}`,
      }));
      await replacePaymentAllocations(
        tenant,
        savedPayment.id,
        allocations.length > 0
          ? allocations
          : [
              {
                id: `alloc-${savedPayment.id}`,
                invoiceId: savedPayment.invoiceId,
                amount: savedPayment.amount,
              },
            ],
      );
      await tryPostPaymentJournal(tenant, savedPayment);

      const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
      broadcastTenantUpdate(tenant, "collection", "finance_invoices");
      broadcastTenantUpdate(tenant, "collection", "finance_payments");
      return savedPayment;
    },

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
