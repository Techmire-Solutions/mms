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

/**
 * Points for one issued card. Single definition for the whole module: the denomination's own
 * `points` value, never a name/id guess. A card whose denomination row is gone contributes 0,
 * matching `aggregateHasanatCommandMetrics`.
 */
function denominationPointsSql(denAlias = "den"): ReturnType<typeof sql> {
  return sql`COALESCE(${sql.raw(`${denAlias}.points`)}, 0)`;
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
      const pointsExpr = denominationPointsSql("den");
      // Points are attributed by the card's own session (`session_id`, stamped at issue time).
      // Joining through enrollments instead added a student's *lifetime* points to every session
      // they were enrolled in.
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
        )
        SELECT
          sel."sessionId" AS "sessionId",
          COALESCE(SUM(hd.quantity * ${pointsExpr}), 0)::float8 AS hasanat
        FROM selected sel
        LEFT JOIN hasanat_distributions hd
          ON ${activeDistributionWhere(subdomain, "hd")}
          AND hd.session_id = sel."sessionId"
        LEFT JOIN hasanat_denoms den
          ON den.workspace_subdomain = ${subdomain}
          AND den.id = hd.denomination_id
        GROUP BY sel."sessionId"
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
      const pointsExpr = denominationPointsSql("den");
      const monthResult = await tx.execute(sql`
        SELECT
          to_char(hd.issued_date, 'YYYY-MM') AS "monthKey",
          COALESCE(SUM(hd.quantity * ${pointsExpr}), 0)::float8 AS points
        FROM hasanat_distributions hd
        LEFT JOIN hasanat_denoms den
          ON den.workspace_subdomain = ${subdomain}
          AND den.id = hd.denomination_id
        WHERE ${activeDistributionWhere(subdomain, "hd")}
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
