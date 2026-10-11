import {
  buildCreditNotePostingLines,
  buildInvoicePostingLines,
  buildLateFeePostingLines,
  buildOpeningEntryLines,
  buildPaymentPostingLines,
  buildReversalLines,
  findFiscalYearForDate,
  type FiscalYear,
  type Invoice,
  type JournalEntry,
  type OpeningBalance,
  type Payment,
} from "@mms/shared";
import crypto from "node:crypto";
import {
  findEntryById,
  findEntryIdBySource,
  saveEntry,
} from "../../db/repositories/accountingRepository.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  assertJournalEntryPeriodOpen,
  prepareJournalEntryForPersist,
} from "../use-cases/accountingLedgerGuards.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";

function postingDate(value: string | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

/**
 * Persist a system-generated entry at most once per `(source_type, source_id)`.
 *
 * Idempotency is enforced twice: this pre-check, and the partial unique index
 * `accounting_entries_workspace_source_uidx`. Two concurrent callers can both
 * pass the pre-check, so a unique violation on save means "the other caller won
 * the race and the posting already exists" — an expected outcome, not an error,
 * and it must not surface to the user as a 500.
 */
async function persistGeneratedEntry(
  tenant: string,
  entry: JournalEntry,
  years?: readonly FiscalYear[],
): Promise<JournalEntry | null> {
  const existingId = await findEntryIdBySource(
    tenant,
    entry.source_type ?? "",
    entry.source_id ?? "",
  );
  if (existingId) return null;
  const resolvedYears = years ?? (await listFiscalYearsByWorkspace(tenant));
  // System postings are always new, so the period lock applies unconditionally.
  assertJournalEntryPeriodOpen(entry, resolvedYears);
  const prepared = prepareJournalEntryForPersist(entry, resolvedYears);
  try {
    await saveEntry(tenant, prepared);
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
  return prepared;
}

function entryForSource(
  sourceType: JournalEntry["source_type"],
  sourceId: string,
  date: string,
  description: string,
  lines: JournalEntry["lines"],
  fiscalYearId?: string,
): JournalEntry {
  return {
    id: `je-${sourceType}-${sourceId}`,
    date,
    ref: `${sourceType}:${sourceId}`,
    description,
    status: "posted",
    created_by: "system",
    tags: [],
    attachments: [],
    fiscal_year: "",
    fiscal_year_id: fiscalYearId,
    source_type: sourceType,
    source_id: sourceId,
    lines,
  };
}

/**
 * Fiscal year whose range contains the posting date. Returns undefined when the
 * date falls outside every configured year rather than silently posting to the
 * active year.
 */
function resolveYearId(years: readonly FiscalYear[], date: string): string | undefined {
  return findFiscalYearForDate(years, date)?.id;
}

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

export async function tryPostInvoiceReversalJournal(
  tenant: string,
  invoice: Invoice,
): Promise<void> {
  const existingId = await findEntryIdBySource(tenant, "invoice", invoice.id);
  if (!existingId) return;
  const original = await findEntryById(tenant, existingId);
  if (!original?.lines?.length) return;
  const date = postingDate(undefined);
  const lines = buildReversalLines(original.lines);
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "reversal",
      invoice.id,
      date,
      `Cancel ${invoice.invoiceNumber ?? invoice.id}`,
      lines,
      resolveYearId(years, date),
    ),
    years,
  );
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

/** Reverses an existing posting identified by its `(source_type, source_id)` key. */
export async function tryPostReversalOfSource(
  tenant: string,
  sourceType: NonNullable<JournalEntry["source_type"]>,
  sourceId: string,
  description: string,
): Promise<void> {
  const existingId = await findEntryIdBySource(tenant, sourceType, sourceId);
  if (!existingId) return;
  const original = await findEntryById(tenant, existingId);
  if (!original?.lines?.length) return;
  const date = postingDate(undefined);
  const lines = buildReversalLines(original.lines);
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource("reversal", sourceId, date, description, lines, resolveYearId(years, date)),
    years,
  );
}

/**
 * Reverses the late-fee posting for an invoice.
 *
 * `tryPostInvoiceReversalJournal` reverses only `('invoice', invoiceId)`, while
 * late fees post under `('invoice', 'latefee:<invoiceId>')` (see
 * {@link tryPostLateFeeJournals}). Without this the fee survived cancellation
 * and left AR and income overstated by the fee amount.
 */
export async function tryPostLateFeeReversalJournal(
  tenant: string,
  invoice: Invoice,
): Promise<void> {
  await tryPostReversalOfSource(
    tenant,
    "invoice",
    `latefee:${invoice.id}`,
    `Reverse late fee ${invoice.invoiceNumber ?? invoice.id}`,
  );
}

/**
 * Source key for an archive / restore ledger event.
 *
 * Archiving is repeatable — archive, restore, archive again — so the key has to
 * differ per cycle, or `persistGeneratedEntry` would treat the second archive's
 * reversal as a replay of the first and leave the posting on the books. Both
 * keys derive from the archive's own `deletedAt`: stable within a cycle, so a
 * retry stays idempotent, and distinct across cycles. The value is hashed
 * because `source_id` is `varchar(64)` and a bare `<uuid-id>:<iso-timestamp>`
 * overflows it.
 */
function lifecycleSourceId(
  entityId: string,
  event: "archive" | "restore",
  archivedAt: string,
): string {
  return `${event}-${crypto.hash("sha256", `${entityId}|${event}|${archivedAt}`, "hex").slice(0, 40)}`;
}

/**
 * Reverses a source document's posting when its record is archived.
 *
 * A soft delete used to leave the original Dr/Cr on the books forever, so the
 * ledger kept reporting receivables and cash for invoices and payments the
 * finance module had already archived. No-op when the document never posted.
 */
export async function tryPostArchiveReversalJournal(
  tenant: string,
  sourceType: NonNullable<JournalEntry["source_type"]>,
  sourceId: string,
  archivedAt: string,
  description: string,
): Promise<void> {
  const existingId = await findEntryIdBySource(tenant, sourceType, sourceId);
  if (!existingId) return;
  const original = await findEntryById(tenant, existingId);
  if (!original?.lines?.length) return;
  const date = postingDate(undefined);
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "reversal",
      lifecycleSourceId(sourceId, "archive", archivedAt),
      date,
      description,
      buildReversalLines(original.lines),
      resolveYearId(years, date),
    ),
    years,
  );
}

/**
 * Re-applies a source document's original posting when its record is restored.
 *
 * Posts only when this cycle's archive reversal is actually on the books, so a
 * record archived while the workspace had no posting rules — and therefore
 * never reversed — does not gain an entry it never had on the way out.
 */
export async function tryPostRestoreJournal(
  tenant: string,
  sourceType: NonNullable<JournalEntry["source_type"]>,
  sourceId: string,
  archivedAt: string,
  description: string,
): Promise<void> {
  const reversalId = await findEntryIdBySource(
    tenant,
    "reversal",
    lifecycleSourceId(sourceId, "archive", archivedAt),
  );
  if (!reversalId) return;
  const existingId = await findEntryIdBySource(tenant, sourceType, sourceId);
  if (!existingId) return;
  const original = await findEntryById(tenant, existingId);
  if (!original?.lines?.length) return;
  const date = postingDate(undefined);
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "reversal",
      lifecycleSourceId(sourceId, "restore", archivedAt),
      date,
      description,
      original.lines,
      resolveYearId(years, date),
    ),
    years,
  );
}

export async function tryPostCreditNoteJournal(
  tenant: string,
  invoice: Invoice,
  creditNoteId: string,
  amount: number,
): Promise<void> {
  const accounts = await getPostingRules(tenant);
  const date = postingDate(undefined);
  const lines = buildCreditNotePostingLines({
    creditNoteId,
    amount,
    description: `Credit note ${invoice.invoiceNumber ?? invoice.id}`,
    accounts,
  });
  if (!lines) return;
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "reversal",
      creditNoteId,
      date,
      `Credit note ${invoice.invoiceNumber ?? invoice.id}`,
      lines,
      resolveYearId(years, date),
    ),
    years,
  );
}
