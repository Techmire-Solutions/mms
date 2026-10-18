import type { Invoice, Payment } from "@mms/shared";
import type { FinanceRepository } from "../repository/financeRepository.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  tryPostArchiveReversalJournal,
  tryPostRestoreJournal,
} from "../../accounting/ledgerPosting/ledgerPostingService.js";

/**
 * Ledger and subledger consequences of archiving or restoring a finance record.
 *
 * Cancelling an invoice has always posted its reversal, but archiving went
 * straight to a soft-delete: the invoice left the directory while its Dr AR /
 * Cr Income stayed on the books, and archiving a payment additionally left the
 * invoice reading `paid` with the collected amount intact. These helpers make
 * archive and restore symmetric on both sides.
 */

type ArchivableRepo = Pick<
  FinanceRepository,
  "findInvoicesByIds" | "findPaymentsByIds" | "saveInvoice"
>;

/** Late fees post under their own source key, so the invoice entry alone is not the whole posting. */
function invoicePostingSources(invoice: Invoice): { sourceId: string; label: string }[] {
  const label = invoice.invoiceNumber ?? invoice.id;
  return [
    { sourceId: invoice.id, label: `Archive ${label}` },
    { sourceId: `latefee:${invoice.id}`, label: `Archive late fee ${label}` },
  ];
}

/** Total the invoice must collect before it counts as settled. */
function invoiceTotalDue(invoice: Invoice): number {
  return invoice.finalAmt + (invoice.lateFeeAmt ?? 0) - (invoice.creditedAmt ?? 0);
}

/**
 * Applies a change in collected amount and re-derives the status.
 *
 * A fully un-collected invoice returns to `pending` rather than guessing at
 * `overdue` — `collectOverdueInvoices` owns that transition and will re-mark it
 * on its next sweep.
 */
function applyCollectedDelta(invoice: Invoice, delta: number): Invoice {
  const paidAmt = Math.max(0, (invoice.paidAmt ?? 0) + delta);
  const totalDue = invoiceTotalDue(invoice);
  return {
    ...invoice,
    paidAmt,
    status: paidAmt <= 0 ? "pending" : paidAmt >= totalDue ? "paid" : "partial",
  };
}

/**
 * Rolls the archived payments' amounts off their invoices.
 *
 * Amounts are summed per invoice first, so archiving several payments against
 * one invoice writes that invoice once instead of once per payment.
 */
async function applyPaymentDeltas(
  repo: ArchivableRepo,
  tenant: string,
  payments: readonly Payment[],
  direction: 1 | -1,
): Promise<void> {
  const deltaByInvoice = new Map<string, number>();
  for (const payment of payments) {
    deltaByInvoice.set(
      payment.invoiceId,
      (deltaByInvoice.get(payment.invoiceId) ?? 0) + payment.amount * direction,
    );
  }
  const invoices = await repo.findInvoicesByIds(tenant, [...deltaByInvoice.keys()], {
    includeDeleted: true,
  });
  for (const invoice of invoices) {
    // A cancelled invoice has already had its posting reversed; re-deriving its
    // status from the collected amount would silently revive it.
    if (invoice.status === "cancelled") continue;
    const delta = deltaByInvoice.get(invoice.id);
    if (!delta) continue;
    await repo.saveInvoice(tenant, applyCollectedDelta(invoice, delta));
  }
}

/** Reverses the ledger postings of every invoice that was just archived. */
export async function onInvoicesArchived(
  repo: ArchivableRepo,
  tenant: string,
  ids: readonly string[],
): Promise<void> {
  const invoices = await repo.findInvoicesByIds(tenant, [...ids], { includeDeleted: true });
  for (const invoice of invoices) {
    if (!invoice.deletedAt) continue;
    for (const source of invoicePostingSources(invoice)) {
      await tryPostArchiveReversalJournal(
        tenant,
        "invoice",
        source.sourceId,
        invoice.deletedAt,
        source.label,
      );
    }
  }
}

/**
 * Re-applies the ledger postings of every invoice that was just restored.
 *
 * `archivedAt` is read before the restore clears it, because it is the key the
 * archive reversal was filed under.
 */
export async function onInvoicesRestored(
  tenant: string,
  restored: readonly { invoice: Invoice; archivedAt: string }[],
): Promise<void> {
  for (const { invoice, archivedAt } of restored) {
    const label = invoice.invoiceNumber ?? invoice.id;
    await tryPostRestoreJournal(tenant, "invoice", invoice.id, archivedAt, `Restore ${label}`);
    await tryPostRestoreJournal(
      tenant,
      "invoice",
      `latefee:${invoice.id}`,
      archivedAt,
      `Restore late fee ${label}`,
    );
  }
}

/** Reverses the cash posting and un-collects the invoice for every payment just archived. */
export async function onPaymentsArchived(
  repo: ArchivableRepo,
  tenant: string,
  ids: readonly string[],
): Promise<void> {
  const payments = await repo.findPaymentsByIds(tenant, [...ids], { includeDeleted: true });
  const archived = payments.filter((payment) => payment.deletedAt);
  if (archived.length === 0) return;

  await applyPaymentDeltas(repo, tenant, archived, -1);
  for (const payment of archived) {
    await tryPostArchiveReversalJournal(
      tenant,
      "payment",
      payment.id,
      payment.deletedAt as string,
      `Archive payment ${payment.id}`,
    );
  }
}

/** Re-applies the cash posting and re-collects the invoice for every payment just restored. */
export async function onPaymentsRestored(
  repo: ArchivableRepo,
  tenant: string,
  restored: readonly { payment: Payment; archivedAt: string }[],
): Promise<void> {
  if (restored.length === 0) return;

  await applyPaymentDeltas(
    repo,
    tenant,
    restored.map((entry) => entry.payment),
    1,
  );
  for (const { payment, archivedAt } of restored) {
    await tryPostRestoreJournal(
      tenant,
      "payment",
      payment.id,
      archivedAt,
      `Restore payment ${payment.id}`,
    );
  }
}

/** The soft-delete surface of a `createGenericRelationalService` collection. */
interface SoftDeletableCrud {
  deleteById(id: string, deletedBy: string, deletionReason?: string): Promise<boolean>;
  restoreById(id: string, userId?: string): Promise<boolean>;
  bulkDeleteByIds(
    ids: string[],
    deletedBy: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreByIds(ids: string[], userId?: string): Promise<{ succeeded: number; failed: number }>;
}

/**
 * The finance composition root's archive / restore operations.
 *
 * Each one wraps the plain soft delete together with its ledger and subledger
 * consequences in a single transaction, so the directory, the invoice balance
 * and the ledger move together or not at all.
 */
export function createFinanceLifecycleOperations(deps: {
  repo: ArchivableRepo;
  invoiceCrud: SoftDeletableCrud;
  paymentCrud: SoftDeletableCrud;
  requireTenant: () => string;
}) {
  const { repo, invoiceCrud, paymentCrud, requireTenant } = deps;

  return {
    deleteInvoiceById: async (id: string, deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const archived = await invoiceCrud.deleteById(id, deletedBy, deletionReason);
        if (archived) await onInvoicesArchived(repo, tenant, [id]);
        return archived;
      });
    },
    restoreInvoiceById: async (id: string, userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const snapshot = await readArchivedInvoices(repo, tenant, [id]);
        const restored = await invoiceCrud.restoreById(id, userId);
        if (restored) await onInvoicesRestored(tenant, snapshot);
        return restored;
      });
    },
    bulkSoftDeleteInvoices: async (ids: string[], deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const result = await invoiceCrud.bulkDeleteByIds(ids, deletedBy, deletionReason);
        if (result.succeeded > 0) await onInvoicesArchived(repo, tenant, ids);
        return result;
      });
    },
    bulkRestoreInvoices: async (ids: string[], userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const snapshot = await readArchivedInvoices(repo, tenant, ids);
        const result = await invoiceCrud.bulkRestoreByIds(ids, userId);
        if (result.succeeded > 0) await onInvoicesRestored(tenant, snapshot);
        return result;
      });
    },

    deletePaymentById: async (id: string, deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const archived = await paymentCrud.deleteById(id, deletedBy, deletionReason);
        if (archived) await onPaymentsArchived(repo, tenant, [id]);
        return archived;
      });
    },
    restorePaymentById: async (id: string, userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const snapshot = await readArchivedPayments(repo, tenant, [id]);
        const restored = await paymentCrud.restoreById(id, userId);
        if (restored) await onPaymentsRestored(repo, tenant, snapshot);
        return restored;
      });
    },
    bulkSoftDeletePayments: async (ids: string[], deletedBy: string, deletionReason?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const result = await paymentCrud.bulkDeleteByIds(ids, deletedBy, deletionReason);
        if (result.succeeded > 0) await onPaymentsArchived(repo, tenant, ids);
        return result;
      });
    },
    bulkRestorePayments: async (ids: string[], userId?: string) => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const snapshot = await readArchivedPayments(repo, tenant, ids);
        const result = await paymentCrud.bulkRestoreByIds(ids, userId);
        if (result.succeeded > 0) await onPaymentsRestored(repo, tenant, snapshot);
        return result;
      });
    },
  };
}

/** Snapshot of the rows about to be restored, taken while `deletedAt` is still set. */
export async function readArchivedInvoices(
  repo: ArchivableRepo,
  tenant: string,
  ids: readonly string[],
): Promise<{ invoice: Invoice; archivedAt: string }[]> {
  const invoices = await repo.findInvoicesByIds(tenant, [...ids], { includeDeleted: true });
  return invoices
    .filter((invoice) => invoice.deletedAt)
    .map((invoice) => ({ invoice, archivedAt: invoice.deletedAt as string }));
}

export async function readArchivedPayments(
  repo: ArchivableRepo,
  tenant: string,
  ids: readonly string[],
): Promise<{ payment: Payment; archivedAt: string }[]> {
  const payments = await repo.findPaymentsByIds(tenant, [...ids], { includeDeleted: true });
  return payments
    .filter((payment) => payment.deletedAt)
    .map((payment) => ({ payment, archivedAt: payment.deletedAt as string }));
}
