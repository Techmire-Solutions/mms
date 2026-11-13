import { and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { accountingAccounts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

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

const CENTS = "ROUND(l.debit * 100)";

function ledgerFilter(tenant: string, accountId: string): ReturnType<typeof sql> {
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
  tenant: string,
  accountId: string,
): Promise<LedgerAccountSummary | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
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
  });
}

/** Debit − credit (in cents) from the ledger start through the day before `dateFrom`. */
export async function sumLedgerOpeningCents(
  tenant: string,
  accountId: string,
  dateFrom: string | undefined,
): Promise<number> {
  if (!dateFrom) return 0;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      SELECT COALESCE(SUM(${sql.raw(CENTS)} - ROUND(l.credit * 100)), 0)::bigint AS cents
        FROM accounting_journal_lines l
        JOIN accounting_entries e ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
       WHERE ${ledgerFilter(subdomain, accountId)}
         AND e.date < ${dateFrom}
    `);
    return Number((result.rows as Array<{ cents: string }>)[0]?.cents ?? 0);
  });
}

/** Debit and credit totals (in cents) inside the requested window. */
export async function sumLedgerMovementCents(
  tenant: string,
  accountId: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): Promise<{ debitCents: number; creditCents: number }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
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
  });
}

/**
 * One page of ledger lines with the running balance accumulated from the ledger
 * start. Ordered by date, entry and line id so paging is stable.
 */
export async function listLedgerLinesPage(
  tenant: string,
  accountId: string,
  window: { dateFrom?: string; dateTo?: string; offset: number; limit: number },
): Promise<{ lines: LedgerLineCents[]; total: number }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      WITH ledger AS (
        SELECT l.id,
               l.entry_id,
               e.date,
               e.ref,
               e.description AS entry_description,
               l.description AS line_description,
               ${sql.raw(CENTS)}::bigint AS debit_cents,
               ROUND(l.credit * 100)::bigint AS credit_cents,
               SUM(${sql.raw(CENTS)} - ROUND(l.credit * 100)) OVER (
                 ORDER BY e.date, l.entry_id, l.id
               )::bigint AS running_cents,
               ROW_NUMBER() OVER (ORDER BY e.date, l.entry_id, l.id) AS rn,
               COUNT(*) OVER ()::int AS total
          FROM accounting_journal_lines l
          JOIN accounting_entries e ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
         WHERE ${ledgerFilter(subdomain, accountId)}
           AND (${window.dateFrom ?? null}::date IS NULL OR e.date >= ${window.dateFrom ?? null}::date)
           AND (${window.dateTo ?? null}::date IS NULL OR e.date <= ${window.dateTo ?? null}::date)
      )
      SELECT * FROM ledger WHERE rn > ${window.offset} AND rn <= ${window.offset + window.limit}
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
      total: Number(rows[0]?.total ?? 0),
    };
  });
}

export interface AgingRowCents {
  studentId: string;
  studentName: string;
  className: string;
  sessionName: string;
  invoiceCount: number;
  currentCents: number;
  d1_30Cents: number;
  d31_60Cents: number;
  d61_90Cents: number;
  d90PlusCents: number;
  totalCents: number;
}

export interface AgingTotalsCents {
  currentCents: number;
  d1_30Cents: number;
  d31_60Cents: number;
  d61_90Cents: number;
  d90PlusCents: number;
  totalCents: number;
  invoiceCount: number;
  totalStudents: number;
}

/** Open AR balance per invoice in cents: final + late fee − credits − paid. */
const OPEN_BALANCE_CENTS = sql`(ROUND(i.final_amt * 100) + ROUND(COALESCE(i.late_fee_amt, 0) * 100)
  - ROUND(COALESCE(i.credited_amt, 0) * 100) - ROUND(COALESCE(i.paid_amt, 0) * 100))`;

const AGE_DAYS = sql`(${sql.raw("as_of")}::date - i.due_date)`;

const BUCKET_SUMS = sql`SUM(CASE WHEN i.due_date >= ${sql.raw("as_of")}::date THEN ${OPEN_BALANCE_CENTS} ELSE 0 END)::bigint AS current_cents,
  SUM(CASE WHEN i.due_date < ${sql.raw("as_of")}::date AND ${AGE_DAYS} <= 30 THEN ${OPEN_BALANCE_CENTS} ELSE 0 END)::bigint AS d1_30_cents,
  SUM(CASE WHEN ${AGE_DAYS} > 30 AND ${AGE_DAYS} <= 60 THEN ${OPEN_BALANCE_CENTS} ELSE 0 END)::bigint AS d31_60_cents,
  SUM(CASE WHEN ${AGE_DAYS} > 60 AND ${AGE_DAYS} <= 90 THEN ${OPEN_BALANCE_CENTS} ELSE 0 END)::bigint AS d61_90_cents,
  SUM(CASE WHEN ${AGE_DAYS} > 90 THEN ${OPEN_BALANCE_CENTS} ELSE 0 END)::bigint AS d90_plus_cents,
  SUM(${OPEN_BALANCE_CENTS})::bigint AS total_cents`;

/**
 * Per-student open receivables bucketed by days past due as of `asOf`.
 *
 * Only open, non-deleted invoices count (paid/cancelled excluded); the invoice's
 * stored balances are used, so a late fee raised after the as-of date cannot
 * change a bucket.
 */
export async function listReceivablesAging(
  tenant: string,
  asOf: string,
  limit: number,
): Promise<{ rows: AgingRowCents[]; totals: AgingTotalsCents }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rowsResult = await tx.execute(sql`
      WITH as_of AS (SELECT ${asOf}::date AS as_of)
      SELECT i.student_id AS student_id,
             MAX(i.student_name) AS student_name,
             MAX(i.class) AS class_name,
             MAX(i.session) AS session_name,
             COUNT(*)::int AS invoice_count,
             ${BUCKET_SUMS}
        FROM finance_invoices i, as_of
       WHERE i.workspace_subdomain = ${subdomain}
         AND i.deleted_at IS NULL
         AND i.status IN ('pending', 'partial', 'overdue')
         AND ${OPEN_BALANCE_CENTS} > 0
       GROUP BY i.student_id
       ORDER BY total_cents DESC, i.student_id
       LIMIT ${limit + 1}
    `);
    const rows = (rowsResult.rows as Array<Record<string, string | number>>).map((row) => ({
      studentId: String(row.student_id),
      studentName: String(row.student_name ?? ""),
      className: String(row.class_name ?? ""),
      sessionName: String(row.session_name ?? ""),
      invoiceCount: Number(row.invoice_count ?? 0),
      currentCents: Number(row.current_cents ?? 0),
      d1_30Cents: Number(row.d1_30_cents ?? 0),
      d31_60Cents: Number(row.d31_60_cents ?? 0),
      d61_90Cents: Number(row.d61_90_cents ?? 0),
      d90PlusCents: Number(row.d90_plus_cents ?? 0),
      totalCents: Number(row.total_cents ?? 0),
    }));

    const totalsResult = await tx.execute(sql`
      WITH as_of AS (SELECT ${asOf}::date AS as_of)
      SELECT COUNT(DISTINCT i.student_id)::int AS total_students,
             COUNT(*)::int AS invoice_count,
             ${BUCKET_SUMS},
             SUM(${OPEN_BALANCE_CENTS})::bigint AS total_cents
        FROM finance_invoices i, as_of
       WHERE i.workspace_subdomain = ${subdomain}
         AND i.deleted_at IS NULL
         AND i.status IN ('pending', 'partial', 'overdue')
         AND ${OPEN_BALANCE_CENTS} > 0
    `);
    const totalsRow = (totalsResult.rows as Array<Record<string, string | number>>)[0] ?? {};
    return {
      rows,
      totals: {
        currentCents: Number(totalsRow.current_cents ?? 0),
        d1_30Cents: Number(totalsRow.d1_30_cents ?? 0),
        d31_60Cents: Number(totalsRow.d31_60_cents ?? 0),
        d61_90Cents: Number(totalsRow.d61_90_cents ?? 0),
        d90PlusCents: Number(totalsRow.d90_plus_cents ?? 0),
        totalCents: Number(totalsRow.total_cents ?? 0),
        invoiceCount: Number(totalsRow.invoice_count ?? 0),
        totalStudents: Number(totalsRow.total_students ?? 0),
      },
    };
  });
}
