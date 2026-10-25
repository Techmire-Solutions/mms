import type { FinanceRepository } from "../repository/financeRepository.js";
import { financeRepository } from "../repository/financeRepositoryAdapter.js";
import {
  dedupeTrimmedIds,
  getOutstandingAmountForInvoice,
  invoiceTotalsFromLines,
  paymentRecordSchema,
  resolveFamilyContactId,
  type Invoice,
  type InvoiceCreateInput,
  type InvoiceUpdate,
  type Payment,
  type PaymentCreateInput,
} from "@mms/shared";
import type { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { runInTransaction } from "../../db/database.js";
import {
  allocateNextInvoiceNumber,
  replacePaymentAllocations,
} from "../../db/repositories/financeBillingRepository.js";
import {
  tryPostInvoiceJournal,
  tryPostPaymentJournal,
} from "../../accounting/ledgerPosting/ledgerPostingService.js";
import { findEntryIdBySource } from "../../db/repositories/accountingRepository.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { resolveDocumentFx, resolvePaymentFx } from "./financeDocumentFx.js";
import { loadFinanceModulePreferences } from "../../services/financePreferencesService.js";

const LEDGER_SENSITIVE_INVOICE_AMOUNTS = [
  "finalAmt",
  "discountAmt",
  "lateFeeAmt",
  "paidAmt",
] as const satisfies readonly (keyof Invoice)[];

const LEDGER_AFFECTING_INVOICE_STATUSES = new Set(["cancelled", "paid"]);

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

/**
 * Realized FX needs a gain/loss account whenever payments post to the ledger;
 * check before saving so a payment is never stored with a journal that cannot post.
 */
async function assertRealizedFxPostable(tenant: string, realizedFx: number | undefined) {
  if (!realizedFx) return;
  const rules = await getPostingRules(tenant);
  if (rules.cashAccountId && rules.arAccountId && !rules.fxRealizedAccountId) {
    throw Object.assign(
      new Error("Set a realized FX gain/loss account in Accounting → Setup before settling at a new rate"),
      { statusCode: 422, type: "validation_error" },
    );
  }
}

export interface FinanceMutationOperationsDeps {
  repo: FinanceRepository;
  invoiceCrud: ReturnType<typeof createGenericRelationalService<Invoice>>;
  requireTenant: () => string;
}

export function createFinanceMutationOperations({
  repo,
  invoiceCrud,
  requireTenant,
}: FinanceMutationOperationsDeps) {
  return {
    createInvoice: async (record: InvoiceCreateInput): Promise<Invoice> => {
      const tenant = requireTenant();
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
      const fx = await resolveDocumentFx(tenant, record, record.dueDate);
      const created = await invoiceCrud.create({
        ...record,
        currency: fx.currency,
        exchangeRate: fx.exchangeRate,
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
      const tenant = requireTenant();
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

    bulkUpdateInvoicesStatus: async (
      ids: string[],
      status: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant) return { succeeded: 0, failed: cleanIds.length };
      if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };
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

    createPayment: async (record: PaymentCreateInput): Promise<Payment> => {
      const tenant = requireTenant();
      const resolvedId = String(record.id ?? `pay-${Date.now()}`);
      const normalizedPayment = paymentRecordSchema.parse({ ...record, id: resolvedId }) as Payment;

      let settledInvoice: Invoice | null = null;
      const savedPayment = await runInTransaction(async () => {
        const existingPayment = await repo.findPaymentById(tenant, resolvedId);
        if (existingPayment) return existingPayment;

        const invoice = await repo.findInvoiceById(tenant, normalizedPayment.invoiceId);
        if (!invoice || invoice.deletedAt) {
          const err = new Error("Referenced invoice is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }

        const paymentFx = await resolvePaymentFx(tenant, invoice, normalizedPayment);
        Object.assign(normalizedPayment, paymentFx);
        await assertRealizedFxPostable(tenant, normalizedPayment.realizedFx);
        settledInvoice = invoice;

        // Cross-currency payments settle the invoice in its own currency.
        const applied = normalizedPayment.invoiceAmount ?? normalizedPayment.amount;
        const paidAmount = invoice.paidAmt ?? 0;
        const remainingBalance = getOutstandingAmountForInvoice(invoice);
        if (applied > remainingBalance) {
          throw new Error("Payment amount exceeds the remaining invoice balance");
        }

        const newPaid = paidAmount + applied;
        await repo.saveInvoice(tenant, {
          ...invoice,
          status: remainingBalance - applied <= 0 ? "paid" : "partial",
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
                amount: savedPayment.invoiceAmount ?? savedPayment.amount,
              },
            ],
      );
      await tryPostPaymentJournal(tenant, savedPayment, settledInvoice ?? undefined);

      const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
      broadcastTenantUpdate(tenant, "collection", "finance_invoices");
      broadcastTenantUpdate(tenant, "collection", "finance_payments");
      return savedPayment;
    },
  };
}
