import {
  buildCreditNotePostingLines,
  buildReversalLines,
  type Invoice,
  type JournalEntry,
} from "@mms/shared";
import crypto from "node:crypto";
import { findEntryById, findEntryIdBySource } from "../../db/repositories/accountingRepository.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  entryForSource,
  persistGeneratedEntry,
  postingDate,
  resolveYearId,
} from "./ledgerPostingHelpers.js";
import { stampLinesForDocument } from "./documentFxPosting.js";

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
 * `tryPostLateFeeJournals`). Without this the fee survived cancellation
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
export function lifecycleSourceId(
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
  // Credit notes are issued in the invoice's currency and reverse AR at its booked rate.
  const stamped = await stampLinesForDocument(tenant, invoice, date, accounts, lines);
  const years = await listFiscalYearsByWorkspace(tenant);
  await persistGeneratedEntry(
    tenant,
    entryForSource(
      "reversal",
      creditNoteId,
      date,
      `Credit note ${invoice.invoiceNumber ?? invoice.id}`,
      stamped,
      resolveYearId(years, date),
    ),
    years,
  );
}
