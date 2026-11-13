import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  OPEN_INVOICE_STATUSES,
  type FinanceCommandMetricsSnapshot,
  type FinanceListQuery,
  type FinanceInvoicesListPageResult,
  type FinancePaymentsListPageResult,
} from "@mms/shared";
import { financeInvoices, financePayments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";
import { runListPage } from "./listPageHelper.js";
import { invoiceRowToRecord, paymentRowToRecord } from "./financeRepository.js";
import {
  buildInvoiceListConditions,
  buildInvoiceOrderBy,
  buildPaymentListConditions,
  buildPaymentOrderBy,
} from "./financeListQueryBuilders.js";

export async function listInvoicesPage(
  tenant: string,
  query: FinanceListQuery & { afterId?: string; skipCount?: boolean },
): Promise<FinanceInvoicesListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage(tx, financeInvoices, {
      conditions: buildInvoiceListConditions(subdomain, query),
      orderBy: buildInvoiceOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 12,
      rowMapper: invoiceRowToRecord,
    });

    return {
      invoices: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

export async function listPaymentsPage(
  tenant: string,
  query: FinanceListQuery & { afterId?: string; skipCount?: boolean },
): Promise<FinancePaymentsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage(tx, financePayments, {
      conditions: buildPaymentListConditions(subdomain, query),
      orderBy: buildPaymentOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 12,
      rowMapper: paymentRowToRecord,
    });

    return {
      payments: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * SQL aggregates for Finance command-centre metrics. Month buckets are computed
 * in the workspace's timezone (`todayInTimeZone` + the month key) so a day is
 * bucketed the way the tenant sees it, not the way the server clock sees it.
 *
 * Money columns are `numeric`; the sums stay `numeric` in SQL and are rendered as
 * exact decimal text, then converted once at the boundary. Casting the sum to
 * `float8` (the previous shape) reintroduced binary floating point on a value
 * that the column types exist to keep exact.
 */
export async function aggregateFinanceCommandMetrics(
  tenant: string,
): Promise<FinanceCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceTodayIso(subdomain);
  const thisMonth = today.slice(0, 7);
  const [year, month] = thisMonth.split("-").map((part) => Number(part));
  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${pad2(month - 1)}`;

  return withTenantRead(subdomain, async (tx) => {
    const activeInvoices = and(
      eq(financeInvoices.workspaceSubdomain, subdomain),
      isNull(financeInvoices.deletedAt),
    );
    const openStatuses = OPEN_INVOICE_STATUSES as readonly string[];

    // Per-invoice collected / outstanding amounts, mirroring the JS reducer.
    const collectedExpr = sql<number>`case
      when ${financeInvoices.status} = 'paid' then ${financeInvoices.finalAmt}::numeric
      when ${financeInvoices.status} = 'partial' then coalesce(${financeInvoices.paidAmt}, 0)
      else 0
    end`;
    const outstandingExpr = sql<number>`case
      when ${financeInvoices.status} in ('cancelled','paid') then 0
      when ${financeInvoices.status} = 'partial' then greatest(0, ${financeInvoices.finalAmt} - coalesce(${financeInvoices.paidAmt}, 0))
      else ${financeInvoices.finalAmt}
    end`;
    // Month key of paid_date, falling back to due_date for unpaid invoices.
    const collectMonth = sql<string>`to_char(coalesce(${financeInvoices.paidDate}, ${financeInvoices.dueDate}), 'YYYY-MM')`;
    const dueMonth = sql<string>`to_char(${financeInvoices.dueDate}, 'YYYY-MM')`;

    const [row] = await tx
      .select({
        totalInvoices: sql<number>`count(*)::int`,
        outstanding: sql<number>`count(*) filter (where ${financeInvoices.status} in (${sql.join(
          openStatuses.map((s) => sql`${s}`),
          sql`, `,
        )}))::int`,
        overdue: sql<number>`count(*) filter (where ${financeInvoices.status} = 'overdue')::int`,
        paid: sql<number>`count(*) filter (where ${financeInvoices.status} = 'paid')::int`,
        partial: sql<number>`count(*) filter (where ${financeInvoices.status} = 'partial')::int`,
        collectedTotal: sql<string>`coalesce(sum(${collectedExpr}) filter (where ${financeInvoices.status} <> 'cancelled'), 0)::numeric::text`,
        outstandingBalance: sql<string>`coalesce(sum(${outstandingExpr}) filter (where ${financeInvoices.status} <> 'cancelled'), 0)::numeric::text`,
        discountTotal: sql<string>`coalesce(sum(${financeInvoices.discountAmt}) filter (where ${financeInvoices.status} <> 'cancelled'), 0)::numeric::text`,
        collectedThisMonth: sql<string>`coalesce(sum(${collectedExpr}) filter (where ${financeInvoices.status} <> 'cancelled' and ${collectMonth} = ${thisMonth}), 0)::numeric::text`,
        collectedPrevMonth: sql<string>`coalesce(sum(${collectedExpr}) filter (where ${financeInvoices.status} <> 'cancelled' and ${collectMonth} = ${prevMonth}), 0)::numeric::text`,
        outstandingThisMonth: sql<string>`coalesce(sum(${outstandingExpr}) filter (where ${financeInvoices.status} <> 'cancelled' and ${dueMonth} = ${thisMonth}), 0)::numeric::text`,
        outstandingPrevMonth: sql<string>`coalesce(sum(${outstandingExpr}) filter (where ${financeInvoices.status} <> 'cancelled' and ${dueMonth} = ${prevMonth}), 0)::numeric::text`,
      })
      .from(financeInvoices)
      .where(activeInvoices);

    const [paymentRow] = await tx
      .select({ totalPayments: sql<number>`count(*)::int` })
      .from(financePayments)
      .where(
        and(eq(financePayments.workspaceSubdomain, subdomain), isNull(financePayments.deletedAt)),
      );

    return {
      totalInvoices: Number(row?.totalInvoices ?? 0),
      outstanding: Number(row?.outstanding ?? 0),
      overdue: Number(row?.overdue ?? 0),
      paid: Number(row?.paid ?? 0),
      partial: Number(row?.partial ?? 0),
      totalPayments: Number(paymentRow?.totalPayments ?? 0),
      collectedTotal: Number(row?.collectedTotal ?? 0),
      outstandingBalance: Number(row?.outstandingBalance ?? 0),
      discountTotal: Number(row?.discountTotal ?? 0),
      collectedThisMonth: Number(row?.collectedThisMonth ?? 0),
      collectedPrevMonth: Number(row?.collectedPrevMonth ?? 0),
      outstandingThisMonth: Number(row?.outstandingThisMonth ?? 0),
      outstandingPrevMonth: Number(row?.outstandingPrevMonth ?? 0),
    };
  });
}

export async function bulkUpdateInvoicesStatusSql(
  tenant: string,
  ids: string[],
  status: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };

  // Single atomic UPDATE ... id IN (...) returning matched rows, instead of one
  // round-trip per id in a loop. RLS/soft-delete rows are simply not matched, so
  // succeeded = rows touched and failed = ids - succeeded (identical to the old
  // per-id loop, minus per-id try/catch overhead).
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(financeInvoices)
      .set({
        status: status as "paid" | "pending" | "overdue" | "partial" | "cancelled",
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          inArray(financeInvoices.id, cleanIds),
          isNull(financeInvoices.deletedAt),
        ),
      )
      .returning({ id: financeInvoices.id });

    return {
      succeeded: updated.length,
      failed: Math.max(0, cleanIds.length - updated.length),
    };
  });
}
