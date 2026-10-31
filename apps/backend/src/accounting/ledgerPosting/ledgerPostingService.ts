import {
  buildInvoicePostingLines,
  buildLateFeePostingLines,
  buildOpeningEntryLines,
  buildPaymentPostingLines,
  type Invoice,
  type JournalEntry,
  type OpeningBalance,
  type Payment,
} from "@mms/shared";
import { findEntryById, findEntryIdBySource } from "../../db/repositories/accountingRepository.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  entryForSource,
  persistGeneratedEntry,
  postingDate,
  resolveYearId,
} from "./ledgerPostingHelpers.js";

// Re-export reversal & lifecycle posting functions for backward compatibility
export {
  tryPostInvoiceReversalJournal,
  tryPostReversalOfSource,
  tryPostLateFeeReversalJournal,
  lifecycleSourceId,
  tryPostArchiveReversalJournal,
  tryPostRestoreJournal,
  tryPostCreditNoteJournal,
} from "./ledgerReversalPostingService.js";
export {
  syncObligationJournal,
  tryPostObligationArchiveJournal,
  tryPostObligationJournal,
  tryPostObligationRestoreJournal,
} from "./obligationPostingService.js";

/** Posts Dr AR / Cr Income when posting accounts are configured. Skips otherwise. */
export async function tryPostInvoiceJournal(tenant: string, invoice: Invoice): Promise<void> {
  if (invoice.status === "cancelled" || invoice.deletedAt) return;
  const accounts = await getPostingRules(tenant);
  const date = postingDate(invoice.dueDate);
  const lines = buildInvoicePostingLines({
    invoiceId: invoice.id,
    description: invoice.invoiceNumber ?? invoice.id,
    date,
    finalAmt: invoice.finalAmt,
    discountAmt: invoice.discountAmt,
    accounts,
  });
  if (!lines) return;
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "invoice",
      invoice.id,
      date,
      `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
      lines,
      resolveYearId(years, date),
    ),
    years,
  );
}

/** Posts Dr Cash / Cr AR when posting accounts are configured. Skips otherwise. */
export async function tryPostPaymentJournal(tenant: string, payment: Payment): Promise<void> {
  const accounts = await getPostingRules(tenant);
  const date = postingDate(payment.date);
  const lines = buildPaymentPostingLines({
    paymentId: payment.id,
    description: payment.note || payment.id,
    date,
    amount: payment.amount,
    accounts,
  });
  if (!lines) return;
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "payment",
      payment.id,
      date,
      `Payment ${payment.id}`,
      lines,
      resolveYearId(years, date),
    ),
    years,
  );
}

export async function tryPostOpeningJournal(
  tenant: string,
  fiscalYearId: string,
  balances: OpeningBalance[],
): Promise<JournalEntry | null> {
  const years = await listFiscalYearsByWorkspace(tenant);
  const year = years.find((row) => row.id === fiscalYearId);
  if (!year)
    throw Object.assign(new Error("Fiscal year not found"), { statusCode: 404, type: "not_found" });
  const lines = buildOpeningEntryLines(balances);
  if (!lines) {
    throw Object.assign(new Error("Opening balances must form a balanced journal"), {
      statusCode: 422,
      type: "validation_error",
    });
  }
  const entry = entryForSource(
    "opening",
    fiscalYearId,
    year.startDate,
    `Opening balances ${year.label}`,
    lines,
    fiscalYearId,
  );

  // Opening balances are edited over time, but the source key allows only one
  // entry per fiscal year. Rather than reporting success while silently ignoring
  // the edit, distinguish "unchanged replay" from "the balances actually moved".
  const existingId = await findEntryIdBySource(tenant, "opening", fiscalYearId);
  if (existingId) {
    const original = await findEntryById(tenant, existingId);
    if (openingLinesMatch(original?.lines, lines)) return null;
    throw Object.assign(
      new Error(
        "Opening balances were already posted for this fiscal year — reverse that entry before posting revised balances",
      ),
      { statusCode: 422, type: "validation_error" },
    );
  }

  return persistGeneratedEntry(tenant, entry, years);
}

/** Same accounts and same debit/credit on each side, ignoring line ids/descriptions. */
function openingLinesMatch(
  stored: JournalEntry["lines"] | undefined,
  incoming: JournalEntry["lines"],
): boolean {
  if (!stored || stored.length !== incoming.length) return false;
  const normalize = (lines: JournalEntry["lines"]): string =>
    lines
      .map((line) => `${line.account_id}|${line.debit}|${line.credit}`)
      .sort()
      .join(";");
  return normalize(stored) === normalize(incoming);
}

export async function tryPostLateFeeJournals(
  tenant: string,
  fees: readonly { invoice: Invoice; amount: number }[],
): Promise<void> {
  if (fees.length === 0) return;
  const accounts = await getPostingRules(tenant);
  const years = await listFiscalYearsByWorkspace(tenant);
  const date = postingDate(undefined);
  const yearId = resolveYearId(years, date);
  for (const fee of fees) {
    const lines = buildLateFeePostingLines({
      invoiceId: fee.invoice.id,
      amount: fee.amount,
      description: `Late fee ${fee.invoice.invoiceNumber ?? fee.invoice.id}`,
      accounts,
    });
    if (!lines) continue;
    await persistGeneratedEntry(
      tenant,
      entryForSource(
        "invoice",
        `latefee:${fee.invoice.id}`,
        date,
        `Late fee ${fee.invoice.invoiceNumber ?? fee.invoice.id}`,
        lines,
        yearId,
      ),
      years,
    );
  }
}
