import { sql } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  enrollmentsReportComparisonQueryActive,
  ensureAllSessionsInComparison,
  type EnrollmentsReportAggregates,
  type EnrollmentsReportBySessionItem,
  type EnrollmentsReportComparison,
  type EnrollmentsReportComparisonMonth,
  type EnrollmentsReportComparisonQuery,
  type EnrollmentsReportComparisonSession,
  type EnrollmentsReportFees,
  type EnrollmentsReportStatusCounts,
} from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";

/**
 * SQL report aggregates for EnrollmentChart + EnrollmentReports
 * (+ optional ComparisonMode session/date slices).
 */
export async function loadEnrollmentsReportAggregatesSql(
  tenant: string,
  comparisonQuery?: EnrollmentsReportComparisonQuery,
): Promise<EnrollmentsReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const trendsResult = await tx.execute(sql`
      WITH months AS (
        SELECT
          to_char(d, 'YYYY-MM') AS "monthKey",
          to_char(
            (date_trunc('month', d) + interval '1 month' - interval '1 day')::date,
            'YYYY-MM-DD'
          ) AS month_end
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - interval '11 months',
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) AS d
      ),
      active AS (
        SELECT e.enrolled_on AS enrolled_on
        FROM enrollments e
        WHERE e.workspace_subdomain = ${subdomain}
          AND e.deleted_at IS NULL
          AND e.enrolled_on IS NOT NULL
      )
      SELECT
        m."monthKey",
        (
          SELECT count(*)::int
          FROM active a
          WHERE a.enrolled_on::text <= m.month_end
        ) AS students
      FROM months m
      ORDER BY m."monthKey" ASC
    `);

    const trendRows = getQueryRows<Record<string, unknown>>(trendsResult);
    const cumulativeTrends: Array<{ monthKey: string; students: number }> = [];
    for (let i = 0; i < trendRows.length; i++) {
      const row = trendRows[i];
      if (typeof row?.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)) {
        cumulativeTrends.push({
          monthKey: row.monthKey,
          students: Number(row.students ?? 0),
        });
      }
    }

    const statusResult = await tx.execute(sql`
      SELECT
        lower(trim(e.status)) AS status,
        count(*)::int AS count
      FROM enrollments e
      WHERE e.workspace_subdomain = ${subdomain}
        AND e.deleted_at IS NULL
      GROUP BY 1
    `);

    const statusCounts: EnrollmentsReportStatusCounts = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      total: 0,
    };
    for (const row of getQueryRows<Record<string, unknown>>(statusResult)) {
      const count = Number(row.count ?? 0);
      statusCounts.total += count;
      const status = String(row.status ?? "");
      if (status === "pending") statusCounts.pending += count;
      else if (status === "confirmed") statusCounts.confirmed += count;
      else if (status === "cancelled") statusCounts.cancelled += count;
      else if (status === "completed") statusCounts.completed += count;
    }

    const feesResult = await tx.execute(sql`
      SELECT
        COALESCE(
          sum(
            CASE
              WHEN ${enrollmentHoldsSeatSql("e")}
              THEN e.final_fee::numeric
              ELSE 0
            END
          ),
          0
        ) AS due,
        COALESCE(
          sum(
            CASE
              WHEN lower(trim(e.payment_status)) = 'paid'
              THEN e.final_fee::numeric
              ELSE 0
            END
          ),
          0
        ) AS paid
      FROM enrollments e
      WHERE e.workspace_subdomain = ${subdomain}
        AND e.deleted_at IS NULL
    `);

    const feeRow = getQueryRows<Record<string, unknown>>(feesResult)[0];
    const fees: EnrollmentsReportFees = {
      due: Number(feeRow?.due ?? 0),
      paid: Number(feeRow?.paid ?? 0),
    };

    const sessionResult = await tx.execute(sql`
      SELECT
        e.session_id AS "sessionId",
        e.session_name AS name,
        count(*)::int AS count,
        COALESCE(
          sum(
            CASE
              WHEN ${enrollmentHoldsSeatSql("e")}
              THEN e.final_fee::numeric
              ELSE 0
            END
          ),
          0
        ) AS revenue
      FROM enrollments e
      WHERE e.workspace_subdomain = ${subdomain}
        AND e.deleted_at IS NULL
      GROUP BY 1, 2
      ORDER BY count DESC, name ASC
    `);

    const bySession: EnrollmentsReportBySessionItem[] = getQueryRows<Record<string, unknown>>(
      sessionResult,
    ).map((row) => ({
      sessionId: String(row.sessionId ?? ""),
      name: String(row.name ?? ""),
      count: Number(row.count ?? 0),
      revenue: Number(row.revenue ?? 0),
    }));

    const aggregates: EnrollmentsReportAggregates = {
      cumulativeTrends,
      statusCounts,
      fees,
      bySession,
    };

    if (enrollmentsReportComparisonQueryActive(comparisonQuery) && comparisonQuery) {
      const comparison: EnrollmentsReportComparison = {
        sessions: [],
        monthly: { a: [], b: [] },
      };

      const sessionIds = dedupeTrimmedIds(comparisonQuery.sessionIds ?? []);
      if (sessionIds.length > 0) {
        const compareSessionResult = await tx.execute(sql`
          SELECT
            e.session_id AS "sessionId",
            count(*)::int AS "enrollmentCount",
            coalesce(
              array_agg(DISTINCT e.student_id)
                FILTER (WHERE e.student_id IS NOT NULL AND e.student_id <> ''),
              '{}'::text[]
            ) AS "studentIds"
          FROM enrollments e
          WHERE e.workspace_subdomain = ${subdomain}
            AND e.deleted_at IS NULL
            AND e.session_id IN (${sql.join(
              sessionIds.map((id) => sql`${id}`),
              sql`, `,
            )})
            AND ${enrollmentHoldsSeatSql("e")}
          GROUP BY 1
        `);

        comparison.sessions = ensureAllSessionsInComparison(
          getQueryRows<Record<string, unknown>>(compareSessionResult).map((row) => {
            const rawIds = row.studentIds;
            const studentIds = dedupeTrimmedIds(
              Array.isArray(rawIds)
                ? rawIds
                : typeof rawIds === "string"
                  ? rawIds.replace(/[{}]/g, "")
                  : [],
            );
            return {
              sessionId: String(row.sessionId ?? ""),
              enrollmentCount: Number(row.enrollmentCount ?? 0),
              studentIds,
            } satisfies EnrollmentsReportComparisonSession;
          }),
          sessionIds,
          (sessionId) => ({ sessionId, enrollmentCount: 0, studentIds: [] }),
        );
      }

      const loadMonthlyRange = async (
        from: string | undefined,
        to: string | undefined,
      ): Promise<EnrollmentsReportComparisonMonth[]> => {
        if (!from || !to) return [];
        const monthResult = await tx.execute(sql`
          SELECT
            to_char(e.enrolled_on, 'YYYY-MM') AS "monthKey",
            count(*)::int AS count
          FROM enrollments e
          WHERE e.workspace_subdomain = ${subdomain}
            AND e.deleted_at IS NULL
            AND e.enrolled_on IS NOT NULL
            AND e.enrolled_on::text >= ${from}
            AND e.enrolled_on::text <= ${to}
          GROUP BY 1
          ORDER BY 1 ASC
        `);
        const rows = getQueryRows<Record<string, unknown>>(monthResult);
        const monthly: EnrollmentsReportComparisonMonth[] = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (typeof row?.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)) {
            monthly.push({
              monthKey: row.monthKey,
              count: Number(row.count ?? 0),
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
    }

    return aggregates;
  });
}
