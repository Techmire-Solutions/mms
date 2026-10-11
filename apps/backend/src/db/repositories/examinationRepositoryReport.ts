import { sql } from "drizzle-orm";
import {
  EMPTY_EXAMINATIONS_REPORT_AGGREGATES,
  dedupeTrimmedIds,
  ensureAllSessionsInComparison,
  examinationsReportComparisonQueryActive,
  type ExaminationsReportAggregates,
  type ExaminationsReportComparison,
  type ExaminationsReportComparisonMonth,
  type ExaminationsReportComparisonQuery,
  type ExaminationsReportComparisonSession,
} from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";

function activeExamWhere(subdomain: string, alias = "e"): ReturnType<typeof sql> {
  return sql`
    ${sql.raw(`${alias}.workspace_subdomain`)} = ${subdomain}
    AND ${sql.raw(`${alias}.deleted_at`)} IS NULL
  `;
}

/** Examinations report aggregates for ComparisonMode (session passRatePct + dual monthly ranges). */
export async function loadExaminationsReportAggregatesSql(
  tenant: string,
  comparisonQuery?: ExaminationsReportComparisonQuery,
): Promise<ExaminationsReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) return { ...EMPTY_EXAMINATIONS_REPORT_AGGREGATES };

  return withTenantRead(subdomain, async (tx) => {
    const aggregates: ExaminationsReportAggregates = { ...EMPTY_EXAMINATIONS_REPORT_AGGREGATES };
    if (!examinationsReportComparisonQueryActive(comparisonQuery) || !comparisonQuery) {
      return aggregates;
    }

    const comparison: ExaminationsReportComparison = {
      sessions: [],
      monthly: { a: [], b: [] },
    };

    const sessionIds = dedupeTrimmedIds(comparisonQuery.sessionIds ?? []);
    if (sessionIds.length > 0) {
      const compareSessionResult = await tx.execute(sql`
        WITH selected AS (
          SELECT
            s.id AS "sessionId",
            s.name AS "sessionName"
          FROM sessions s
          WHERE s.workspace_subdomain = ${subdomain}
            AND s.deleted_at IS NULL
            AND s.id IN (${sql.join(
              sessionIds.map((id: string) => sql`${id}`),
              sql`, `,
            )})
        ),
        session_classes AS (
          SELECT
            sc.session_id,
            sc.class_id
          FROM session_classes sc
          WHERE sc.workspace_subdomain = ${subdomain}
        ),
        exam_results_cte AS (
          SELECT
            er.exam_id,
            er.marks_obtained
          FROM exam_results er
          WHERE er.workspace_subdomain = ${subdomain}
        )
        SELECT
          sel."sessionId" AS "sessionId",
          COUNT(erc.exam_id) AS "totalCount",
          SUM(
            CASE WHEN COALESCE(erc.marks_obtained, 0) >= COALESCE(e.passing_marks, 0) THEN 1 ELSE 0 END
          ) AS "passCount"
        FROM selected sel
        LEFT JOIN session_classes sc ON sc.session_id = sel."sessionId"
        LEFT JOIN exam_classes ec ON ec.class_id = sc.class_id AND ec.workspace_subdomain = ${subdomain}
        LEFT JOIN exams e ON e.id = ec.exam_id AND ${activeExamWhere(subdomain, "e")}
        LEFT JOIN exam_results_cte erc ON erc.exam_id = e.id
        GROUP BY sel."sessionId"
      `);

      comparison.sessions = ensureAllSessionsInComparison(
        getQueryRows<Record<string, unknown>>(compareSessionResult).map(
          (row: Record<string, unknown>) => {
            const total = Number(row.totalCount ?? 0);
            const pass = Number(row.passCount ?? 0);
            return {
              sessionId: String(row.sessionId ?? ""),
              passRatePct: total > 0 ? Math.round((pass / total) * 100) : 0,
            } satisfies ExaminationsReportComparisonSession;
          },
        ),
        sessionIds,
        (sessionId) => ({ sessionId, passRatePct: 0 }),
      );
    }

    const loadMonthlyRange = async (
      rawFrom: string | undefined,
      rawTo: string | undefined,
    ): Promise<ExaminationsReportComparisonMonth[]> => {
      const from = rawFrom?.trim();
      const to = rawTo?.trim();
      if (!from || !to) return [];
      const monthResult = await tx.execute(sql`
        SELECT
          to_char(left(NULLIF(trim(e.date), ''), 10)::date, 'YYYY-MM') AS "monthKey",
          COUNT(er.id) AS "totalCount",
          SUM(CASE WHEN COALESCE(er.marks_obtained, 0) >= COALESCE(e.passing_marks, 0) THEN 1 ELSE 0 END) AS "passCount"
        FROM exams e
        LEFT JOIN exam_results er ON er.exam_id = e.id AND er.workspace_subdomain = ${subdomain}
        WHERE ${activeExamWhere(subdomain, "e")}
          AND NULLIF(trim(e.date), '') IS NOT NULL
          AND NULLIF(trim(e.date), '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND left(NULLIF(trim(e.date), ''), 10) >= ${from}
          AND left(NULLIF(trim(e.date), ''), 10) <= ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      const rows = getQueryRows<Record<string, unknown>>(monthResult);
      const monthly: ExaminationsReportComparisonMonth[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (typeof row?.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)) {
          monthly.push({
            monthKey: row.monthKey,
            passCount: Number(row.passCount ?? 0),
            totalCount: Number(row.totalCount ?? 0),
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
