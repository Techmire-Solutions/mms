import { sql } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  EMPTY_FINANCE_REPORT_AGGREGATES,
  ensureAllSessionsInComparison,
  financeReportComparisonQueryActive,
  type FinanceReportAggregates,
  type FinanceReportComparison,
  type FinanceReportComparisonMonth,
  type FinanceReportComparisonQuery,
  type FinanceReportComparisonSession,
} from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Collected amount SQL — mirrors `getCollectedAmountForInvoice`:
 * paid → finalAmt; partial → paidAmt or round(finalAmt/2); else 0.
 */
function collectedAmountSql(alias = "fi"): ReturnType<typeof sql> {
  return sql`
    CASE
      WHEN lower(trim(COALESCE(${sql.raw(`${alias}.status`)}, ''))) = 'paid'
        THEN COALESCE(${sql.raw(`${alias}.final_amt`)}, 0)
      WHEN lower(trim(COALESCE(${sql.raw(`${alias}.status`)}, ''))) = 'partial'
        THEN COALESCE(
          ${sql.raw(`${alias}.paid_amt`)},
          ROUND(COALESCE(${sql.raw(`${alias}.final_amt`)}, 0) / 2)
        )
      ELSE 0
    END
  `;
}

function activeInvoiceWhere(subdomain: string, alias = "fi"): ReturnType<typeof sql> {
  return sql`
    ${sql.raw(`${alias}.workspace_subdomain`)} = ${subdomain}
    AND ${sql.raw(`${alias}.deleted_at`)} IS NULL
  `;
}

/** Finance report aggregates for ComparisonMode (session feeCollected + dual monthly ranges). */
export async function loadFinanceReportAggregatesSql(
  tenant: string,
  comparisonQuery?: FinanceReportComparisonQuery,
): Promise<FinanceReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) return { ...EMPTY_FINANCE_REPORT_AGGREGATES };

  return withTenantRead(subdomain, async (tx) => {
    const aggregates: FinanceReportAggregates = { ...EMPTY_FINANCE_REPORT_AGGREGATES };
    const collected = collectedAmountSql("fi");

    // Monthly fee collections
    const monthlyResult = await tx.execute(sql`
      SELECT
        to_char(left(NULLIF(trim(fi.due_date), ''), 10)::date, 'YYYY-MM') AS "monthKey",
        COALESCE(SUM(${collected}), 0)::float8 AS "collected",
        COALESCE(SUM(GREATEST(0, COALESCE(fi.final_amt, 0) - ${collected})), 0)::float8 AS "outstanding",
        COALESCE(SUM(COALESCE(fi.final_amt, 0)), 0)::float8 AS "total"
      FROM finance_invoices fi
      WHERE ${activeInvoiceWhere(subdomain, "fi")}
        AND NULLIF(trim(fi.due_date), '') IS NOT NULL
        AND NULLIF(trim(fi.due_date), '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const monthlyRows = getQueryRows<Record<string, unknown>>(monthlyResult);
    const monthlyFeeCollection: Array<{
      month: string;
      collected: number;
      outstanding: number;
      total: number;
      rate: number;
    }> = [];
    for (let i = 0; i < monthlyRows.length; i++) {
      const row = monthlyRows[i];
      if (typeof row?.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)) {
        const rowCollected = Number(row.collected ?? 0);
        const rowOutstanding = Number(row.outstanding ?? 0);
        const rowTotal = Number(row.total ?? 0);
        const rate = rowTotal > 0 ? Math.round((rowCollected / rowTotal) * 100) : 0;
        monthlyFeeCollection.push({
          month: row.monthKey,
          collected: rowCollected,
          outstanding: rowOutstanding,
          total: rowTotal,
          rate,
        });
      }
    }
    aggregates.monthlyFeeCollection = monthlyFeeCollection.slice(-6);

    // Discount usage by type
    const discountResult = await tx.execute(sql`
      SELECT
        COALESCE(NULLIF(trim(fi.discount_type), ''), 'other') AS "type",
        COUNT(*)::int AS "count",
        COALESCE(SUM(COALESCE(fi.discount_amt, 0)), 0)::float8 AS "totalDiscounted"
      FROM finance_invoices fi
      WHERE ${activeInvoiceWhere(subdomain, "fi")}
        AND COALESCE(fi.discount_amt, 0) > 0
        AND lower(trim(COALESCE(fi.status, ''))) != 'cancelled'
      GROUP BY 1
    `);

    const discountRows = getQueryRows<Record<string, unknown>>(discountResult).map((row) => ({
      type: String(row.type ?? "other"),
      count: Number(row.count ?? 0),
      totalDiscounted: Number(row.totalDiscounted ?? 0),
    }));

    const totalDiscountSum = discountRows.reduce((sum, d) => sum + d.totalDiscounted, 0);
    aggregates.discountUsageByType = discountRows.map((d) => ({
      type: d.type,
      count: d.count,
      totalDiscounted: d.totalDiscounted,
      percentage:
        totalDiscountSum > 0 ? Math.round((d.totalDiscounted / totalDiscountSum) * 100) : 0,
    }));

    if (!financeReportComparisonQueryActive(comparisonQuery) || !comparisonQuery) {
      return aggregates;
    }

    const comparison: FinanceReportComparison = {
      sessions: [],
      monthly: { a: [], b: [] },
    };

    const sessionIds = dedupeTrimmedIds(comparisonQuery.sessionIds ?? []);
    if (sessionIds.length > 0) {
      const collected = collectedAmountSql("fi");
      const compareSessionResult = await tx.execute(sql`
        WITH selected AS (
          SELECT
            s.id AS "sessionId",
            NULLIF(trim(COALESCE(s.name, '')), '') AS "sessionName"
          FROM sessions s
          WHERE s.workspace_subdomain = ${subdomain}
            AND s.deleted_at IS NULL
            AND s.id IN (${sql.join(
              sessionIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        )
        SELECT
          sel."sessionId" AS "sessionId",
          COALESCE(SUM(${collected}), 0)::float8 AS "feeCollected"
        FROM selected sel
        LEFT JOIN finance_invoices fi
          ON ${activeInvoiceWhere(subdomain, "fi")}
          AND (
            trim(COALESCE(fi.session, '')) = sel."sessionId"
            OR (
              sel."sessionName" IS NOT NULL
              AND trim(COALESCE(fi.session, '')) = sel."sessionName"
            )
          )
        GROUP BY sel."sessionId"
      `);

      comparison.sessions = ensureAllSessionsInComparison(
        getQueryRows<Record<string, unknown>>(compareSessionResult).map(
          (row) =>
            ({
              sessionId: String(row.sessionId ?? ""),
              feeCollected: Number(row.feeCollected ?? 0),
            }) satisfies FinanceReportComparisonSession,
        ),
        sessionIds,
        (sessionId) => ({ sessionId, feeCollected: 0 }),
      );
    }

    const loadMonthlyRange = async (
      from: string | undefined,
      to: string | undefined,
    ): Promise<FinanceReportComparisonMonth[]> => {
      if (!from || !to) return [];
      const collected = collectedAmountSql("fi");
      const monthResult = await tx.execute(sql`
        SELECT
          to_char(left(NULLIF(trim(fi.due_date), ''), 10)::date, 'YYYY-MM') AS "monthKey",
          COALESCE(SUM(${collected}), 0)::float8 AS collected
        FROM finance_invoices fi
        WHERE ${activeInvoiceWhere(subdomain, "fi")}
          AND NULLIF(trim(fi.due_date), '') IS NOT NULL
          AND NULLIF(trim(fi.due_date), '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND left(NULLIF(trim(fi.due_date), ''), 10) >= ${from}
          AND left(NULLIF(trim(fi.due_date), ''), 10) <= ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      const rows = getQueryRows<Record<string, unknown>>(monthResult);
      const monthly: FinanceReportComparisonMonth[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (typeof row?.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)) {
          monthly.push({
            monthKey: row.monthKey,
            collected: Number(row.collected ?? 0),
          });
        }
      }
      return monthly;
    };

    comparison.monthly.a = await loadMonthlyRange(
      comparisonQuery.rangeAFrom,
      comparisonQuery.rangeATo,
    );
    comparison.monthly.b = await loadMonthlyRange(
      comparisonQuery.rangeBFrom,
      comparisonQuery.rangeBTo,
    );
    aggregates.comparison = comparison;
    return aggregates;
  });
}
