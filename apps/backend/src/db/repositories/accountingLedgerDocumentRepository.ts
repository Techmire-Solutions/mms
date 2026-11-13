import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";
import {
  CENTS,
  findLedgerAccount,
  ledgerFilter,
  sumLedgerMovementCents,
  sumLedgerOpeningCents,
  type LedgerAccountSummary,
  type LedgerLineCents,
} from "./accountingReportEndpointsRepository.js";

/**
 * Printable-ledger reads, kept apart from the paged endpoint so both modules stay
 * inside the 300-line ceiling.
 */

/** Hard ceiling for a printable ledger document; a larger ledger must be narrowed. */
export const LEDGER_DOCUMENT_MAX_LINES = 10_000;

/**
 * Every line of one account's window in one snapshot, for the printable ledger.
 *
 * Bounded (`LEDGER_DOCUMENT_MAX_LINES + 1` probes truncation) and ordered like the
 * paged endpoint, so the PDF and the on-screen ledger agree line for line.
 */
export interface LedgerDocument {
  account: LedgerAccountSummary;
  openingCents: number;
  movement: { debitCents: number; creditCents: number };
  lines: LedgerLineCents[];
  truncated: boolean;
}

/**
 * One account's whole printable ledger (account, opening, movement, every line) in
 * one `repeatable read` snapshot, so the PDF's running balances and closing figure
 * cannot disagree with each other.
 */
export async function loadLedgerDocument(
  tenant: string,
  accountId: string,
  window: { dateFrom?: string; dateTo?: string },
): Promise<LedgerDocument | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(
    subdomain,
    async (tx) => {
      const account = await findLedgerAccount(tx, subdomain, accountId);
      if (!account) return null;
      const [openingCents, movement] = await Promise.all([
        sumLedgerOpeningCents(tx, subdomain, accountId, window.dateFrom),
        sumLedgerMovementCents(tx, subdomain, accountId, window.dateFrom, window.dateTo),
      ]);
      const limit = LEDGER_DOCUMENT_MAX_LINES + 1;
      const result = await tx.execute(sql`
        WITH filtered AS (
          SELECT l.id,
                 l.entry_id,
                 e.date,
                 e.ref,
                 e.description AS entry_description,
                 l.description AS line_description,
                 ${sql.raw(CENTS)}::bigint AS debit_cents,
                 ROUND(l.credit * 100)::bigint AS credit_cents
            FROM accounting_journal_lines l
            JOIN accounting_entries e ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
           WHERE ${ledgerFilter(subdomain, accountId)}
             AND (${window.dateFrom ?? null}::date IS NULL OR e.date >= ${window.dateFrom ?? null}::date)
             AND (${window.dateTo ?? null}::date IS NULL OR e.date <= ${window.dateTo ?? null}::date)
        ),
        windowed AS (
          SELECT *,
                 SUM(debit_cents - credit_cents) OVER (ORDER BY date, entry_id, id)::bigint
                   AS running_cents,
                 ROW_NUMBER() OVER (ORDER BY date, entry_id, id) AS rn
            FROM filtered
        )
        SELECT * FROM windowed ORDER BY rn LIMIT ${limit}
      `);
      const rows = result.rows as Array<{
        id: string;
        entry_id: string;
        date: string;
        ref: string;
        entry_description: string;
        line_description: string | null;
        debit_cents: string;
        credit_cents: string;
        running_cents: string;
        rn: string;
      }>;
      const truncated = rows.length > LEDGER_DOCUMENT_MAX_LINES;
      const visible = truncated ? rows.slice(0, LEDGER_DOCUMENT_MAX_LINES) : rows;
      return {
        account,
        openingCents,
        movement,
        truncated,
        lines: visible.map((row) => ({
          id: row.id,
          entryId: row.entry_id,
          date: row.date,
          ref: row.ref,
          description: row.entry_description,
          lineDescription: row.line_description ?? "",
          debitCents: Number(row.debit_cents),
          creditCents: Number(row.credit_cents),
          runningCents: Number(row.running_cents),
        })),
      };
    },
    { isolation: "repeatable read", statementTimeoutMs: 120_000 },
  );
}

export interface LedgerExportRow {
  date: string;
  ref: string;
  description: string;
  lineNote: string;
  debit: string;
  credit: string;
}

export interface LedgerExportPage {
  rows: LedgerExportRow[];
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * One keyset page of an account's journal register for the streamed export.
 *
 * Keyset (not OFFSET) so a long export never re-reads earlier pages, and the cursor
 * is `(date, entryId, lineId)` — the same order the GL endpoint uses. There is no
 * running balance column here: accumulating one across a streamed, multi-page
 * export would need a per-row prefix scan; the UI's page export and the PDF keep it.
 */
export async function listLedgerExportRows(
  tenant: string,
  accountId: string,
  window: { dateFrom?: string; dateTo?: string },
  after: { date: string; entryId: string; lineId: string } | undefined,
  limit: number,
): Promise<LedgerExportPage> {
  const subdomain = tenant.trim().toLowerCase();
  const rows = await withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      SELECT l.id, l.entry_id, e.date, e.ref,
             e.description AS entry_description,
             l.description AS line_description,
             l.debit::text AS debit,
             l.credit::text AS credit
        FROM accounting_journal_lines l
        JOIN accounting_entries e ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
       WHERE ${ledgerFilter(subdomain, accountId)}
         AND (${window.dateFrom ?? null}::date IS NULL OR e.date >= ${window.dateFrom ?? null}::date)
         AND (${window.dateTo ?? null}::date IS NULL OR e.date <= ${window.dateTo ?? null}::date)
         AND (
           ${after ?? null}::text IS NULL
           OR (e.date, l.entry_id, l.id) > (
             ${after?.date ?? ""}::date, ${after?.entryId ?? ""}::text, ${after?.lineId ?? ""}::text
           )
         )
       ORDER BY e.date, l.entry_id, l.id
       LIMIT ${limit + 1}
    `);
    return result.rows as Array<{
      id: string;
      entry_id: string;
      date: string;
      ref: string;
      entry_description: string;
      line_description: string | null;
      debit: string;
      credit: string;
    }>;
  });

  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  return {
    rows: visible.map((row) => ({
      date: row.date,
      ref: row.ref,
      description: row.entry_description,
      lineNote: row.line_description ?? "",
      debit: Number(row.debit).toFixed(2),
      credit: Number(row.credit).toFixed(2),
    })),
    hasMore,
    nextCursor: hasMore && last ? `${last.date}|${last.entry_id}|${last.id}` : undefined,
  };
}
