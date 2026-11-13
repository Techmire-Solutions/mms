import {
  buildInvoicePostingLines,
  buildLateFeePostingLines,
  buildOpeningEntryLines,
  buildPaymentPostingLines,
  buildFxPaymentPostingLines,
  documentCurrency,
  type Invoice,
  type JournalEntry,
  type OpeningBalance,
  type Payment,
} from "@mms/shared";
import { findEntryById, listOpeningEntries } from "../../db/repositories/accountingRepository.js";
import { findActiveReversalOf } from "../../db/repositories/accountingEntryReversalRepository.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  entryForSource,
  persistGeneratedEntries,
  persistGeneratedEntry,
  postingDateForTenant,
  resolveYearId,
} from "./ledgerPostingHelpers.js";
import { stampLinesForDocument } from "./documentFxPosting.js";
import { getCurrencySettings } from "../../db/repositories/accountingCurrencySettingsRepository.js";

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
  const date = await postingDateForTenant(tenant, invoice.dueDate);
  const lines = buildInvoicePostingLines({
    invoiceId: invoice.id,
    description: invoice.invoiceNumber ?? invoice.id,
    date,
    finalAmt: invoice.finalAmt,
    discountAmt: invoice.discountAmt,
    accounts,
  });
  if (!lines) return;
  const stamped = await stampLinesForDocument(tenant, invoice, date, accounts, lines);
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "invoice",
      invoice.id,
      date,
      `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
      stamped,
      resolveYearId(years, date),
    ),
    years,
  );
}

/**
 * Posts Dr AR / Cr Income for a generated batch. Posting rules and fiscal years
 * are loaded once, every entry is built up front, existing `(source_type,
 * source_id)` postings are skipped, and the rest are written in one
 * `bulkSaveEntries` so the whole batch shares the caller's transaction.
 */
export async function tryPostInvoiceJournals(
  tenant: string,
  invoices: readonly Invoice[],
): Promise<void> {
  const billable = invoices.filter(
    (invoice) => invoice.status !== "cancelled" && !invoice.deletedAt,
  );
  if (billable.length === 0) return;
  const accounts = await getPostingRules(tenant);
  const years = await listFiscalYearsByWorkspace(tenant);
  const entries: JournalEntry[] = [];
  for (const invoice of billable) {
    const date = await postingDateForTenant(tenant, invoice.dueDate);
    const lines = buildInvoicePostingLines({
      invoiceId: invoice.id,
      description: invoice.invoiceNumber ?? invoice.id,
      date,
      finalAmt: invoice.finalAmt,
      discountAmt: invoice.discountAmt,
      accounts,
    });
    if (!lines) continue;
    const stamped = await stampLinesForDocument(tenant, invoice, date, accounts, lines);
    entries.push(
      entryForSource(
        "invoice",
        invoice.id,
        date,
        `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
        stamped,
        resolveYearId(years, date),
      ),
    );
  }
  await persistGeneratedEntries(tenant, entries, years);
}

/**
 * Posts Dr Cash / Cr AR when posting accounts are configured. Skips otherwise.
 * A foreign-currency payment books cash at its settlement rate, releases AR at
 * the invoice's booked rate and posts the difference as realized FX.
 */
export async function tryPostPaymentJournal(
  tenant: string,
  payment: Payment,
  invoice?: Pick<Invoice, "id" | "currency" | "exchangeRate">,
): Promise<void> {
  const accounts = await getPostingRules(tenant);
  const date = await postingDateForTenant(tenant, payment.date);
  const { functionalCurrency } = await getCurrencySettings(tenant);
  const paymentCurrency = documentCurrency(payment, functionalCurrency);
  const invoiceCurrency = invoice ? documentCurrency(invoice, functionalCurrency) : paymentCurrency;
  const lines =
    paymentCurrency === functionalCurrency && invoiceCurrency === functionalCurrency
      ? buildPaymentPostingLines({
          paymentId: payment.id,
          description: payment.note || payment.id,
          date,
          amount: payment.amount,
          accounts,
        })
      : buildFxPaymentPostingLines({
          paymentId: payment.id,
          description: payment.note || payment.id,
          date,
          amount: payment.amount,
          paymentCurrency,
          invoiceAmount: payment.invoiceAmount ?? payment.amount,
          invoiceCurrency,
          functionalCurrency,
          bookedRate: invoice?.exchangeRate ?? payment.exchangeRate ?? "1",
          settlementRate: payment.exchangeRate ?? "1",
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
  // Opening balances are edited over time. The first posting owns the source key
  // `fiscalYearId`; after the user reverses it, the original row (and its unique
  // source key) still exists, so a correction is posted as a revision
  // (`fiscalYearId:r2`, `:r3`, …) instead of being permanently blocked.
  const revisions = await listOpeningEntries(tenant, fiscalYearId);
  const latest = revisions.at(-1);
  if (latest) {
    const reversed = await findActiveReversalOf(tenant, latest);
    if (!reversed) {
      const original = await findEntryById(tenant, latest.id);
      if (openingLinesMatch(original?.lines, lines)) return null;
      throw Object.assign(
        new Error(
          "Opening balances were already posted for this fiscal year — reverse that entry before posting revised balances",
        ),
        { statusCode: 422, type: "validation_error" },
      );
    }
  }
  const sourceId =
    revisions.length === 0 ? fiscalYearId : `${fiscalYearId}:r${revisions.length + 1}`;
  const entry = entryForSource(
    "opening",
    sourceId,
    year.startDate,
    `Opening balances ${year.label}`,
    lines,
    fiscalYearId,
  );
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
  const date = await postingDateForTenant(tenant);
  const yearId = resolveYearId(years, date);
  for (const fee of fees) {
    const built = buildLateFeePostingLines({
      invoiceId: fee.invoice.id,
      amount: fee.amount,
      description: `Late fee ${fee.invoice.invoiceNumber ?? fee.invoice.id}`,
      accounts,
    });
    if (!built) continue;
    // Late fees accrue on the receivable in the invoice's currency at its booked rate.
    const lines = await stampLinesForDocument(tenant, fee.invoice, date, accounts, built);
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
