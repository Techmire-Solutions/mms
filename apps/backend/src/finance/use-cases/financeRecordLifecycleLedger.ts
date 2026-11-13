import type { Invoice, Payment } from "@mms/shared";
import type { FinanceRepository } from "../repository/financeRepository.js";
import {
  tryPostArchiveReversalJournal,
  tryPostRestoreJournal,
} from "../../accounting/ledgerPosting/ledgerPostingService.js";
import { applyPaymentDeltas } from "./financePaymentArchiveDeltas.js";

/**
 * Ledger and subledger consequences of archiving or restoring a finance record,
 * plus the archived-row snapshots the restore path needs.
 *
 * `financeRecordLifecycle.ts` owns the transaction and the audit row; this module
 * owns what the archive/restore does to the books, so each stays under the file
 * length ceiling.
 */

/**
 * Ledger and subledger consequences of archiving or restoring a finance record.
 *
 * Cancelling an invoice has always posted its reversal, but archiving went
 * straight to a soft-delete: the invoice left the directory while its Dr AR /
 * Cr Income stayed on the books, and archiving a payment additionally left the
 * invoice reading `paid` with the collected amount intact. These helpers make
 * archive and restore symmetric on both sides.
 */

export type ArchivableRepo = Pick<
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
