import { randomUUID } from "node:crypto";
import {
  canApplyLateFee,
  canCancelInvoice,
  canCreditInvoice,
  computeLateFee,
  DEFAULT_FINANCE_SETTINGS,
  getOutstandingAmountForInvoice,
  invoiceOpenBalance,
  isInvoiceDueForReminder,
  todayISO,
  toMessagingRecipient,
  wasRemindedRecently,
  type CollectInvoicesBody,
  type CollectInvoicesResult,
  type CreditNote,
  type CreditNoteInsert,
  type Invoice,
  type RemindInvoicesBody,
  type RemindInvoicesResult,
} from "@mms/shared";
import { requireTenant } from "../../lib/tenantContext.js";
import { loadFinanceModulePreferences } from "../../services/financePreferencesService.js";
import { loadContactsByIdsForTenant } from "../../services/contactService.js";
import { financeUseCases } from "./financeUseCases.js";
import {
  applyLateFeeAmounts,
  listCreditNotesForInvoice,
  listInvoicesByIds,
  listOpenInvoicesForCollect,
  markInvoicesReminded,
  markOverdueInvoices,
  saveCreditNote,
} from "../../db/repositories/financeCollectRepository.js";
import {
  tryPostCreditNoteJournal,
  tryPostInvoiceReversalJournal,
  tryPostLateFeeJournals,
  tryPostLateFeeReversalJournal,
} from "../../accounting/ledgerPosting/ledgerPostingService.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  invoiceAuditState,
  recordCreditNoteAudit,
  recordInvoiceAudit,
} from "./financeAuditEvents.js";

function domainError(message: string, statusCode: number, type: string): Error {
  return Object.assign(new Error(message), { statusCode, type });
}

/**
 * Marks overdue invoices and optionally applies late fees.
 *
 * Runs inside one transaction: the status update, the late-fee write on each
 * invoice and the matching journal postings must all land together. Without it,
 * a failure part-way through the posting loop left invoices carrying
 * `late_fee_amt` with no ledger entry — and because `canApplyLateFee` requires
 * `lateFeeAmt <= 0`, every later run skipped them, so those fees could never be
 * posted. The HTTP route happened to wrap this call in a transaction; the
 * `finance:collect` background job did not.
 */
export async function collectOverdueInvoices(
  input: CollectInvoicesBody = {},
): Promise<CollectInvoicesResult> {
  const tenant = requireTenant();
  const body = input;
  const result = await withTenant(tenant, async () => {
    const today = todayISO();
    const prefs = await loadFinanceModulePreferences();
    const lateFeePercent =
      Number.parseFloat(prefs?.lateFeePercent ?? DEFAULT_FINANCE_SETTINGS.lateFeePercent) || 0;
    const markedOverdue = await markOverdueInvoices(tenant, today);
    let lateFeesApplied = 0;
    if (body.applyLateFee && lateFeePercent > 0) {
      const open = await listOpenInvoicesForCollect(tenant);
      const fees = open
        .filter((invoice) => canApplyLateFee(invoice, lateFeePercent, today))
        .map((invoice) => ({ invoice, amount: computeLateFee(invoice.finalAmt, lateFeePercent) }))
        .filter((fee) => fee.amount > 0);
      await applyLateFeeAmounts(
        tenant,
        fees.map((fee) => ({ invoiceId: fee.invoice.id, amount: fee.amount })),
      );
      await tryPostLateFeeJournals(tenant, fees);
      lateFeesApplied = fees.length;
    }
    return { markedOverdue, lateFeesApplied };
  });
  const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
  broadcastTenantUpdate(tenant, "collection", "finance_invoices");
  broadcastTenantUpdate(tenant, "collection", "finance_metrics");
  return result;
}

export async function remindOpenInvoices(
  input: RemindInvoicesBody = {},
): Promise<RemindInvoicesResult> {
  const tenant = requireTenant();
  const body = input;
  const prefs = await loadFinanceModulePreferences();
  if (prefs && !prefs.overdueReminder && !prefs.feeReminders) {
    return { reminded: 0, skipped: 0, recipients: [] };
  }
  const reminderDays =
    Number.parseInt(prefs?.reminderDaysBefore ?? DEFAULT_FINANCE_SETTINGS.reminderDaysBefore, 10) ||
    0;
  const today = todayISO();
  const invoices = body.invoiceIds?.length
    ? await listInvoicesByIds(tenant, body.invoiceIds)
    : await listOpenInvoicesForCollect(tenant);
  const eligible = invoices.filter(
    (invoice) =>
      invoiceOpenBalance(invoice) > 0 &&
      isInvoiceDueForReminder(invoice.dueDate, reminderDays, today) &&
      !wasRemindedRecently(invoice.lastRemindedAt),
  );
  const contactIds = [
    ...new Set(
      eligible.map((invoice) => invoice.familyContactId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const contacts =
    contactIds.length > 0 ? await loadContactsByIdsForTenant(tenant, contactIds) : [];
  const contactById = new Map(contacts.map((contact) => [String(contact.id), contact]));
  const recipients: RemindInvoicesResult["recipients"] = [];
  const remindedIds: string[] = [];
  for (const invoice of eligible) {
    const contact = invoice.familyContactId ? contactById.get(invoice.familyContactId) : undefined;
    if (!contact) continue;
    const recipient = toMessagingRecipient(contact);
    if (!recipient.phone && !recipient.email) continue;
    recipients.push({
      id: String(recipient.id),
      name: recipient.name,
      phone: recipient.phone ?? "",
      email: recipient.email,
      invoiceId: invoice.id,
      dueDate: invoice.dueDate,
      amount: getOutstandingAmountForInvoice(invoice),
    });
    remindedIds.push(invoice.id);
  }
  await markInvoicesReminded(tenant, remindedIds);
  const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
  broadcastTenantUpdate(tenant, "collection", "finance_invoices");
  return {
    reminded: remindedIds.length,
    skipped: invoices.length - remindedIds.length,
    recipients,
  };
}

export async function cancelInvoice(invoiceId: string): Promise<Invoice> {
  const tenant = requireTenant();
  // The status flip, both reversals and the audit row must share one transaction,
  // and the invoice row is locked so a concurrent payment/credit cannot settle it
  // between the `canCancelInvoice` check and the write.
  const cancelled = await withTenant(tenant, async () => {
    const invoice = await financeUseCases.getInvoiceByIdForUpdate(invoiceId);
    if (!invoice || invoice.deletedAt) throw domainError("Invoice not found", 404, "not_found");
    if (!canCancelInvoice(invoice)) {
      throw domainError(
        (invoice.creditedAmt ?? 0) > 0
          ? "Reverse the credit notes on this invoice before cancelling it"
          : "Only unpaid invoices can be cancelled",
        422,
        "validation_error",
      );
    }
    const updated = await financeUseCases.updateInvoiceById(
      invoiceId,
      { ...invoice, status: "cancelled" },
      { audit: false, allowLedgerSensitive: true },
    );
    if (!updated) throw domainError("Invoice not found", 404, "not_found");
    await tryPostInvoiceReversalJournal(tenant, updated);
    // Late fees post under their own source key, so reversing the invoice entry
    // alone left the fee on the books.
    await tryPostLateFeeReversalJournal(tenant, updated);
    await recordInvoiceAudit(
      tenant,
      "UPDATE",
      updated,
      invoiceAuditState(invoice),
      "invoice_cancelled",
    );
    return updated;
  });
  const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
  broadcastTenantUpdate(tenant, "collection", "finance_invoices");
  return cancelled;
}

/**
 * Records a credit note, updates the invoice and posts the offsetting journal in
 * one transaction. The credit-note id is generated fresh on every call, so a
 * partial failure followed by a retry would otherwise record the same credit
 * twice — double-counting the credit in both the subledger and the ledger.
 */
export async function createCreditNote(input: CreditNoteInsert): Promise<CreditNote> {
  const tenant = requireTenant();
  const parsed = input;
  const note = await withTenant(tenant, async () => {
    // Lock the invoice: the open-balance check and the `creditedAmt` write are a
    // read-modify-write, so two concurrent credit notes must serialise.
    const invoice = await financeUseCases.getInvoiceByIdForUpdate(parsed.invoiceId);
    if (!invoice || invoice.deletedAt) throw domainError("Invoice not found", 404, "not_found");
    if (!canCreditInvoice(invoice, parsed.amount)) {
      throw domainError("Credit exceeds the open balance", 422, "validation_error");
    }
    const created: CreditNote = {
      id: `cn-${randomUUID()}`,
      invoiceId: invoice.id,
      amount: parsed.amount,
      reason: parsed.reason ?? "",
      createdAt: new Date().toISOString(),
    };
    const creditedAmt = (invoice.creditedAmt ?? 0) + parsed.amount;
    const remaining = invoiceOpenBalance({ ...invoice, creditedAmt });
    await saveCreditNote(tenant, created);
    await financeUseCases.updateInvoiceById(
      invoice.id,
      {
        ...invoice,
        creditedAmt,
        status: remaining <= 0 ? "paid" : invoice.status,
      },
      { allowLedgerSensitive: true },
    );
    await tryPostCreditNoteJournal(tenant, invoice, created.id, parsed.amount);
    await recordCreditNoteAudit(tenant, created, creditedAmt);
    return created;
  });
  const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
  broadcastTenantUpdate(tenant, "collection", "finance_invoices");
  return note;
}

export async function loadCreditNotes(invoiceId: string): Promise<CreditNote[]> {
  return listCreditNotesForInvoice(requireTenant(), invoiceId);
}
