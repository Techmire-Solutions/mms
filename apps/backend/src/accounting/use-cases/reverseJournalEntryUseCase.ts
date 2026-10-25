import { randomUUID } from "node:crypto";
import {
  NON_REVERSIBLE_JOURNAL_SOURCES,
  buildReversalLines,
  isPriorPeriodJournalReversal,
  validateJournalReversalDate,
  type Account,
  type FiscalYear,
  type JournalEntry,
  type JournalReversalDateIssue,
  type JournalReversalRequest,
} from "@mms/shared";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import type { RecordModernAuditInput } from "../../services/auditTrailService.js";
import {
  assertJournalAccountsWritable,
  assertJournalEntryPeriodOpen,
  ledgerError,
  prepareJournalEntryForPersist,
} from "./accountingLedgerGuards.js";

export interface ReverseJournalEntryDeps {
  transaction: <T>(tenant: string, work: () => Promise<T>) => Promise<T>;
  lockJournalEntries: (tenant: string, ids: string[]) => Promise<void>;
  findEntryById: (tenant: string, id: string) => Promise<JournalEntry | null>;
  findActiveReversalOf: (
    tenant: string,
    original: { id: string; ref: string },
  ) => Promise<{ id: string; ref: string } | null>;
  listFiscalYears: (tenant: string) => Promise<FiscalYear[]>;
  findAccountsByIds: (tenant: string, ids: string[]) => Promise<Account[]>;
  saveEntry: (tenant: string, entry: JournalEntry) => Promise<void>;
  /** Must write inside the same transaction so the audit row commits or rolls back with the reversal. */
  recordAudit: (input: RecordModernAuditInput) => Promise<unknown>;
  broadcast: (tenant: string) => void;
  now: () => Date;
}

export interface JournalReversalActor {
  id: string;
  name?: string;
}

export interface JournalReversalResult {
  entry: JournalEntry;
  original: { id: string; ref: string; date: string };
  priorPeriod: boolean;
  executedAt: string;
}

const DATE_ISSUE_MESSAGES: Record<JournalReversalDateIssue, string> = {
  invalid_date: "Reversal date must be a real calendar date in YYYY-MM-DD format",
  before_original: "Reversal date cannot be earlier than the original posting date",
  closed_period:
    "Reversal date falls in a closed accounting period — choose a date in an open period",
  outside_fiscal_years:
    "Reversal date is outside every configured fiscal year — choose a date in an open period",
};

const SOURCE_REFUSALS: Record<(typeof NON_REVERSIBLE_JOURNAL_SOURCES)[number], string> = {
  invoice: "Invoice postings are reversed from Finance (cancel the invoice or issue a credit note)",
  payment: "Payment postings are reversed from Finance (archive the payment)",
  closing: "Year-end closing entries cannot be reversed",
  fx_reval: "FX revaluations reverse automatically on the next day",
  fx_reval_reversal: "This entry is the automatic reversal of an FX revaluation",
  ias29_restate: "IAS 29 restatements reverse automatically on the next day",
  ias29_reversal: "This entry is the automatic reversal of an IAS 29 restatement",
};

function isNonReversibleSource(
  value: JournalEntry["source_type"],
): value is keyof typeof SOURCE_REFUSALS {
  return (NON_REVERSIBLE_JOURNAL_SOURCES as readonly string[]).includes(value ?? "");
}

function buildReversalEntry(
  original: JournalEntry,
  request: JournalReversalRequest,
  actor: JournalReversalActor,
  priorPeriod: boolean,
): JournalEntry {
  const label = original.ref || original.id;
  const remarks = request.remarks ? ` — ${request.remarks}` : "";
  return {
    id: `je-${randomUUID()}`,
    date: request.date,
    ref: `REV-${label}`.slice(0, 100),
    description: `Reversal of ${label}: ${request.reason}${remarks}`,
    status: "posted",
    created_by: (actor.name?.trim() || actor.id).slice(0, 120),
    tags: priorPeriod ? ["Reversal", "Prior Period"] : ["Reversal"],
    attachments: [],
    fiscal_year: "",
    source_type: "reversal",
    source_id: original.id,
    reversed_ref: original.ref || undefined,
    lines: buildReversalLines(original.lines ?? []),
  };
}

/**
 * Posts a new reversing journal for a posted entry; the original is never edited.
 *
 * Eligibility, period and duplicate checks run after taking the original's
 * advisory lock, inside the transaction that writes the reversal and its audit
 * row — so two concurrent requests commit at most one reversal, and the
 * `(source_type, source_id)` partial unique index backs that up.
 */
export async function reverseJournalEntry(
  tenant: string,
  originalId: string,
  request: JournalReversalRequest,
  actor: JournalReversalActor,
  deps: ReverseJournalEntryDeps,
): Promise<JournalReversalResult> {
  const result = await deps.transaction(tenant, async () => {
    await deps.lockJournalEntries(tenant, [originalId]);
    const original = await deps.findEntryById(tenant, originalId);
    if (!original || original.deletedAt) {
      throw Object.assign(new Error("Journal entry not found"), {
        statusCode: 404,
        type: "not_found",
      });
    }
    if (original.status !== "posted") {
      throw ledgerError(
        "Only posted journal entries can be reversed — edit or discard the draft instead",
      );
    }
    if (isNonReversibleSource(original.source_type))
      throw ledgerError(SOURCE_REFUSALS[original.source_type]);
    if (!original.lines?.length) throw ledgerError("Journal entry has no lines to reverse");

    const existing = await deps.findActiveReversalOf(tenant, {
      id: original.id,
      ref: original.ref,
    });
    if (existing) {
      throw new ConflictError(
        `Journal ${original.ref || original.id} is already reversed by ${existing.ref || existing.id}`,
      );
    }

    const years = await deps.listFiscalYears(tenant);
    const dateIssue = validateJournalReversalDate(original.date, request.date, years);
    if (dateIssue) throw ledgerError(DATE_ISSUE_MESSAGES[dateIssue]);

    const priorPeriod = isPriorPeriodJournalReversal(original.date, request.date, years);
    const entry = prepareJournalEntryForPersist(
      buildReversalEntry(original, request, actor, priorPeriod),
      years,
    );
    assertJournalEntryPeriodOpen(entry, years);
    await assertJournalAccountsWritable(tenant, [entry], deps.findAccountsByIds);

    try {
      await deps.saveEntry(tenant, entry);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `Journal ${original.ref || original.id} is already reversed, or reference ${entry.ref} is in use`,
        );
      }
      throw error;
    }

    const executedAt = deps.now();
    await deps.recordAudit({
      workspaceSubdomain: tenant,
      tableName: "accounting_entries",
      recordId: entry.id,
      actionType: "CREATE",
      realUserId: actor.id,
      transactionTimestamp: executedAt,
      newState: {
        event: "journal_reversal",
        originalEntryId: original.id,
        originalRef: original.ref,
        originalPostingDate: original.date,
        reversalEntryId: entry.id,
        reversalRef: entry.ref,
        reversalPostingDate: entry.date,
        executedAt: executedAt.toISOString(),
        reversedBy: actor.id,
        reason: request.reason,
        remarks: request.remarks ?? null,
        priorPeriod,
      },
    });
    return {
      entry,
      original: { id: original.id, ref: original.ref, date: original.date },
      priorPeriod,
      executedAt: executedAt.toISOString(),
    };
  });
  deps.broadcast(tenant);
  return result;
}
