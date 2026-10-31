import type { AuditActionType, JournalEntry } from "@mms/shared";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/**
 * Minimised journal-entry state for the audit chain: identifiers, status, date
 * and totals only. Descriptions are excluded because callers write free text
 * (including names) into them.
 */
export interface JournalEntryAuditState {
  id: string;
  ref: string;
  date: string;
  status: string;
  sourceType: string;
  sourceId: string;
  debitTotal: number;
  creditTotal: number;
  lineCount: number;
}

const cents = (value: number | undefined): number => Math.round(Number(value ?? 0) * 100);

export function journalEntryAuditState(entry: JournalEntry): JournalEntryAuditState {
  const lines = entry.lines ?? [];
  return {
    id: entry.id,
    ref: entry.ref ?? "",
    date: entry.date,
    status: entry.status,
    sourceType: entry.source_type ?? "manual",
    sourceId: entry.source_id ?? "",
    debitTotal: lines.reduce((sum, line) => sum + cents(line.debit), 0) / 100,
    creditTotal: lines.reduce((sum, line) => sum + cents(line.credit), 0) / 100,
    lineCount: lines.length,
  };
}

/** Appends a journal audit row in the caller's transaction. */
export async function recordJournalEntryAudit(
  tenant: string,
  actionType: AuditActionType,
  entry: JournalEntry,
  oldState?: JournalEntryAuditState | null,
  event?: string,
): Promise<void> {
  const state = journalEntryAuditState(entry);
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "accounting_entries",
    recordId: state.id,
    actionType,
    oldState: oldState ?? undefined,
    newState: event ? { ...state, event } : state,
  });
}
