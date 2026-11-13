import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";

/**
 * Receivables aging: open invoices bucketed by days past due, per student.
 *
 * Split out of `accountingReportEndpointsRepository` to keep both modules inside
 * the 300-line ceiling; the GL and the aging report share no SQL.
 */

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
  page: { offset: number; limit: number },
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
       LIMIT ${page.limit + 1} OFFSET ${page.offset}
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
