import { and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { accountingAccounts } from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";

/**
 * Exact General Ledger and receivables-aging aggregations.
 *
 * Both run in integer cents so a long ledger cannot drift and the client never
 * has to fetch the whole ledger to compute a running balance (the old browser
 * aggregate silently stopped at 5,000 entries).
 */

export interface LedgerAccountSummary {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
}

export interface LedgerLineCents {
  id: string;
  entryId: string;
  date: string;
  ref: string;
  description: string;
  lineDescription: string;
  debitCents: number;
  creditCents: number;
  runningCents: number;
}

export const CENTS = "ROUND(l.debit * 100)";

export function ledgerFilter(tenant: string, accountId: string): ReturnType<typeof sql> {
  return sql`
    l.workspace_subdomain = ${tenant}
    AND l.account_id = ${accountId}
    AND e.workspace_subdomain = l.workspace_subdomain
    AND e.id = l.entry_id
    AND e.deleted_at IS NULL
    AND e.status = 'posted'
  `;
}

/** Active, non-deleted account scoped to the tenant, or null. */
export async function findLedgerAccount(
  tx: TenantTransaction,
  subdomain: string,
  accountId: string,
): Promise<LedgerAccountSummary | null> {
  const [row] = await tx
    .select({
      id: accountingAccounts.id,
      code: accountingAccounts.code,
      name: accountingAccounts.name,
      type: accountingAccounts.type,
      subtype: accountingAccounts.subtype,
    })
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.workspaceSubdomain, subdomain),
        eq(accountingAccounts.id, accountId),
        isNull(accountingAccounts.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Debit − credit (in cents) from the ledger start through the day before `dateFrom`. */
export async function sumLedgerOpeningCents(
  tx: TenantTransaction,
  subdomain: string,
  accountId: string,
  dateFrom: string | undefined,
): Promise<number> {
  if (!dateFrom) return 0;
  const result = await tx.execute(sql`
    SELECT COALESCE(SUM(${sql.raw(CENTS)} - ROUND(l.credit * 100)), 0)::bigint AS cents
      FROM accounting_journal_lines l
      JOIN accounting_entries e ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
     WHERE ${ledgerFilter(subdomain, accountId)}
       AND e.date < ${dateFrom}
  `);
  return Number((result.rows as Array<{ cents: string }>)[0]?.cents ?? 0);
}

/** Debit and credit totals (in cents) inside the requested window. */
export async function sumLedgerMovementCents(
  tx: TenantTransaction,
  subdomain: string,
  accountId: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): Promise<{ debitCents: number; creditCents: number }> {
  const result = await tx.execute(sql`
    SELECT COALESCE(SUM(${sql.raw(CENTS)}), 0)::bigint AS debit_cents,
           COALESCE(SUM(ROUND(l.credit * 100)), 0)::bigint AS credit_cents
      FROM accounting_journal_lines l
      JOIN accounting_entries e ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
     WHERE ${ledgerFilter(subdomain, accountId)}
       AND (${dateFrom ?? null}::date IS NULL OR e.date >= ${dateFrom ?? null}::date)
       AND (${dateTo ?? null}::date IS NULL OR e.date <= ${dateTo ?? null}::date)
  `);
  const row = (result.rows as Array<{ debit_cents: string; credit_cents: string }>)[0];
  return {
    debitCents: Number(row?.debit_cents ?? 0),
    creditCents: Number(row?.credit_cents ?? 0),
  };
}

/**
 * One page of ledger lines with the running balance accumulated from the window
 * start. Ordered by date, entry and line id so paging is stable.
 *
 * Bounded on purpose: the prefix up to `offset + limit` is sorted and windowed
 * (`page_prefix`), so a deep page costs the prefix, not the whole window, and the
 * window's running balance is computed only over rows it can be shown from. The
 * total comes from a separate count so no `COUNT(*) OVER ()` forces every row
 * through the sort/window.
 */
async function listLedgerLinesPage(
  tx: TenantTransaction,
  subdomain: string,
  accountId: string,
  window: { dateFrom?: string; dateTo?: string; offset: number; limit: number },
): Promise<{ lines: LedgerLineCents[]; total: number }> {
  const windowFilter = sql`
    (${window.dateFrom ?? null}::date IS NULL OR e.date >= ${window.dateFrom ?? null}::date)
    AND (${window.dateTo ?? null}::date IS NULL OR e.date <= ${window.dateTo ?? null}::date)
  `;
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
         AND ${windowFilter}
    ),
    page_prefix AS (
      SELECT * FROM filtered
       ORDER BY date, entry_id, id
       LIMIT ${window.offset + window.limit}
    ),
    windowed AS (
      SELECT *,
             SUM(debit_cents - credit_cents) OVER (ORDER BY date, entry_id, id)::bigint
               AS running_cents,
             ROW_NUMBER() OVER (ORDER BY date, entry_id, id) AS rn
        FROM page_prefix
    ),
    total AS (SELECT count(*)::int AS n FROM filtered)
    SELECT windowed.*, total.n AS total
      FROM windowed CROSS JOIN total
     WHERE rn > ${window.offset}
     ORDER BY rn
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
    total: number;
  }>;
  return {
    lines: rows.map((row) => ({
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
    // An empty page still needs the window total.
    total: Number(rows[0]?.total ?? 0),
  };
}

/** Account + opening + window movement + one page, all inside one snapshot. */
export interface LedgerSnapshot {
  account: LedgerAccountSummary;
  openingCents: number;
  movement: { debitCents: number; creditCents: number };
  page: { lines: LedgerLineCents[]; total: number };
}

/**
 * Reads the whole ledger page in **one** `repeatable read` transaction.
 *
 * The three figures used to be three separate read transactions: a posting
 * between them made the page's running balances disagree with the closing
 * balance and with the next page. Under one snapshot they always agree.
 */
export async function loadLedgerSnapshot(
  tenant: string,
  accountId: string,
  window: { dateFrom?: string; dateTo?: string; offset: number; limit: number },
): Promise<LedgerSnapshot | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(
    subdomain,
    async (tx) => {
      const account = await findLedgerAccount(tx, subdomain, accountId);
      if (!account) return null;
      const [openingCents, movement, page] = await Promise.all([
        sumLedgerOpeningCents(tx, subdomain, account.id, window.dateFrom),
        sumLedgerMovementCents(tx, subdomain, account.id, window.dateFrom, window.dateTo),
        listLedgerLinesPage(tx, subdomain, account.id, window),
      ]);
      return { account, openingCents, movement, page };
    },
    { isolation: "repeatable read" },
  );
}
