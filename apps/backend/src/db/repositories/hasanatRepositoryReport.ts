import { sql } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  EMPTY_HASANAT_REPORT_AGGREGATES,
  ensureAllSessionsInComparison,
  hasanatReportComparisonQueryActive,
  type HasanatReportAggregates,
  type HasanatReportComparison,
  type HasanatReportComparisonMonth,
  type HasanatReportComparisonQuery,
  type HasanatReportComparisonSession,
} from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";

function activeDistributionWhere(subdomain: string, alias = "hd"): ReturnType<typeof sql> {
  return sql`
    ${sql.raw(`${alias}.workspace_subdomain`)} = ${subdomain}
    AND ${sql.raw(`${alias}.deleted_at`)} IS NULL
  `;
}

function denominationPointsSql(hdAlias = "hd", denAlias = "den"): ReturnType<typeof sql> {
  return sql`
    COALESCE(
      ${sql.raw(`${denAlias}.points`)},
      CASE
        WHEN ${sql.raw(`${hdAlias}.denomination_id`)} = 'den1' THEN 50
        WHEN ${sql.raw(`${hdAlias}.denomination_id`)} = 'den2' THEN 150
        WHEN ${sql.raw(`${hdAlias}.denomination_id`)} = 'den3' THEN 500
        WHEN ${sql.raw(`${hdAlias}.denomination_id`)} = 'den4' THEN 1000
        WHEN ${sql.raw(`${hdAlias}.denomination_id`)} = 'den5' THEN 2500
        WHEN lower(trim(${sql.raw(`${hdAlias}.denomination_name`)})) LIKE '%silver%' THEN 150
        WHEN lower(trim(${sql.raw(`${hdAlias}.denomination_name`)})) LIKE '%gold%' THEN 500
        WHEN lower(trim(${sql.raw(`${hdAlias}.denomination_name`)})) LIKE '%platinum%' THEN 1000
        WHEN lower(trim(${sql.raw(`${hdAlias}.denomination_name`)})) LIKE '%diamond%' THEN 2500
        ELSE 50
      END
    )
  `;
}

/** Hasanat report aggregates for ComparisonMode (session points + dual monthly ranges). */
export async function loadHasanatReportAggregatesSql(
  tenant: string,
  comparisonQuery?: HasanatReportComparisonQuery,
): Promise<HasanatReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) return { ...EMPTY_HASANAT_REPORT_AGGREGATES };

  return withTenantRead(subdomain, async (tx) => {
    const aggregates: HasanatReportAggregates = { ...EMPTY_HASANAT_REPORT_AGGREGATES };
    if (!hasanatReportComparisonQueryActive(comparisonQuery) || !comparisonQuery) {
      return aggregates;
    }

    const comparison: HasanatReportComparison = {
      sessions: [],
      monthly: { a: [], b: [] },
    };

    const sessionIds = dedupeTrimmedIds(comparisonQuery.sessionIds ?? []);
    if (sessionIds.length > 0) {
      const pointsExpr = denominationPointsSql("hd", "den");
      const compareSessionResult = await tx.execute(sql`
        WITH selected AS (
          SELECT s.id AS "sessionId"
          FROM sessions s
          WHERE s.workspace_subdomain = ${subdomain}
            AND s.deleted_at IS NULL
            AND s.id IN (${sql.join(
              sessionIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        ),
        session_students AS (
          SELECT DISTINCT
            sel."sessionId",
            e.student_id AS "studentId"
          FROM selected sel
          INNER JOIN enrollments e
            ON e.workspace_subdomain = ${subdomain}
            AND e.deleted_at IS NULL
            AND lower(trim(e.status)) <> 'cancelled'
            AND e.session_id = sel."sessionId"
        )
        SELECT
          ss."sessionId" AS "sessionId",
          COALESCE(SUM(hd.quantity * ${pointsExpr}), 0)::float8 AS hasanat
        FROM session_students ss
        LEFT JOIN hasanat_distributions hd
          ON ${activeDistributionWhere(subdomain, "hd")}
          AND ss."studentId" IS NOT NULL
          AND hd.recipient_student_id = ss."studentId"
        LEFT JOIN hasanat_denoms den
          ON den.workspace_subdomain = ${subdomain}
          AND den.id = hd.denomination_id
        GROUP BY ss."sessionId"
      `);

      comparison.sessions = ensureAllSessionsInComparison(
        getQueryRows<Record<string, unknown>>(compareSessionResult).map(
          (row) =>
            ({
              sessionId: String(row.sessionId ?? ""),
              hasanat: Number(row.hasanat ?? 0),
            }) satisfies HasanatReportComparisonSession,
        ),
        sessionIds,
        (sessionId) => ({ sessionId, hasanat: 0 }),
      );
    }

    const loadMonthlyRange = async (
      from: string | undefined,
      to: string | undefined,
    ): Promise<HasanatReportComparisonMonth[]> => {
      const cleanFrom = from?.trim();
      const cleanTo = to?.trim();
      if (!cleanFrom || !cleanTo) return [];
      const pointsExpr = denominationPointsSql("hd", "den");
      const monthResult = await tx.execute(sql`
        SELECT
          to_char(left(hd.issued_date, 10)::date, 'YYYY-MM') AS "monthKey",
          COALESCE(SUM(hd.quantity * ${pointsExpr}), 0)::float8 AS points
        FROM hasanat_distributions hd
        LEFT JOIN hasanat_denoms den
          ON den.workspace_subdomain = ${subdomain}
          AND den.id = hd.denomination_id
        WHERE ${activeDistributionWhere(subdomain, "hd")}
          AND hd.issued_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND hd.issued_date >= ${cleanFrom}
          AND hd.issued_date <= ${cleanTo}
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      const rows = getQueryRows<Record<string, unknown>>(monthResult);
      const monthly: HasanatReportComparisonMonth[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (typeof row?.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)) {
          monthly.push({
            monthKey: row.monthKey,
            points: Number(row.points ?? 0),
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
