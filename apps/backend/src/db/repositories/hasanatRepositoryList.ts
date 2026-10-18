import {
  and,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  asc,
  desc,
  sql,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  toSqlSearchPattern,
  type Distribution,
  type HasanatCommandMetricsSnapshot,
  type HasanatListQuery,
  type HasanatDistributionsListPageResult,
} from "@mms/shared";
import { hasanatBatches, hasanatDenoms, hasanatDistributions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import { distributionRowToRecord } from "./hasanatRepository.js";

function buildDistributionsListConditions(subdomain: string, query: HasanatListQuery): SQL[] {
  const conditions: SQL[] = [eq(hasanatDistributions.workspaceSubdomain, subdomain)];

  // Manifest softDelete.workExcludesDeleted — Work = active, trash = deleted-only.
  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(hasanatDistributions.deletedAt));
  } else {
    conditions.push(isNull(hasanatDistributions.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const pattern = toSqlSearchPattern(search);
    conditions.push(
      or(
        ilike(hasanatDistributions.recipientName, pattern),
        ilike(hasanatDistributions.denominationName, pattern),
        ilike(hasanatDistributions.reason, pattern),
      ) as SQL,
    );
  }

  const statuses = dedupeTrimmedIds(query.status);
  if (statuses.length) {
    conditions.push(inArray(hasanatDistributions.status, statuses));
  }

  return conditions;
}

const DISTRIBUTION_SORT_FIELDS = new Set([
  "recipientName",
  "denominationName",
  "reason",
  "status",
  "issuedDate",
  "updatedAt",
]);

function buildDistributionsOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim();
  let column: AnyColumn = hasanatDistributions.updatedAt;
  if (field && DISTRIBUTION_SORT_FIELDS.has(field)) {
    switch (field) {
      case "recipientName":
        column = hasanatDistributions.recipientName;
        break;
      case "denominationName":
        column = hasanatDistributions.denominationName;
        break;
      case "reason":
        column = hasanatDistributions.reason;
        break;
      case "status":
        column = hasanatDistributions.status;
        break;
      case "issuedDate":
        column = hasanatDistributions.issuedDate;
        break;
      case "updatedAt":
      default:
        column = hasanatDistributions.updatedAt;
    }
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}

type DistributionRow = typeof hasanatDistributions.$inferSelect;

export async function listDistributionsPage(
  tenant: string,
  query: HasanatListQuery & { afterId?: string; skipCount?: boolean },
): Promise<HasanatDistributionsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage<DistributionRow, Distribution>(tx, hasanatDistributions, {
      conditions: buildDistributionsListConditions(subdomain, query),
      orderBy: buildDistributionsOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 15,
      rowMapper: distributionRowToRecord,
    });
    return {
      distributions: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * SQL aggregates for Hasanat command-centre metrics. Week windows are computed
 * in JS as local YYYY-MM-DD strings and compared lexicographically against the
 * `issued_date` varchar — this fixes a latent bug where the prior JS reducer
 * read `distribution.date ?? distribution.distributedAt` (both undefined on
 * loaded rows; the column is `issuedDate`), so `pointsThisWeek`/`pointsLastWeek`
 * were always 0. SQL uses `issued_date` and returns correct values.
 */
export async function aggregateHasanatCommandMetrics(
  tenant: string,
): Promise<HasanatCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(lastWeekStart.getDate() - 13);
  const lastWeekEnd = new Date(today);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  const weekStartStr = localDateStr(weekStart);
  const weekEndStr = localDateStr(today);
  const lastWeekStartStr = localDateStr(lastWeekStart);
  const lastWeekEndStr = localDateStr(lastWeekEnd);

  return withTenantRead(subdomain, async (tx) => {
    // Batches (no soft-delete): stock totals.
    const [batchRow] = await tx
      .select({
        totalStock: sql<number>`coalesce(sum(${hasanatBatches.quantity}), 0)::int`,
        available: sql<number>`coalesce(sum(${hasanatBatches.remaining}), 0)::int`,
      })
      .from(hasanatBatches)
      .where(eq(hasanatBatches.workspaceSubdomain, subdomain));

    // Active distributions: quantity sums by status.
    const activeDistributions = and(
      eq(hasanatDistributions.workspaceSubdomain, subdomain),
      isNull(hasanatDistributions.deletedAt),
    );
    const [distRow] = await tx
      .select({
        distributed: sql<number>`coalesce(sum(${hasanatDistributions.quantity}), 0)::int`,
        redeemed: sql<number>`coalesce(sum(${hasanatDistributions.quantity}) filter (where ${hasanatDistributions.status} = 'redeemed'), 0)::int`,
        active: sql<number>`coalesce(sum(${hasanatDistributions.quantity}) filter (where ${hasanatDistributions.status} = 'active'), 0)::int`,
        returned: sql<number>`coalesce(sum(${hasanatDistributions.quantity}) filter (where ${hasanatDistributions.status} = 'returned'), 0)::int`,
      })
      .from(hasanatDistributions)
      .where(activeDistributions);

    // Active denominations count (active !== false → active = true).
    const [denomRow] = await tx
      .select({
        denominations: sql<number>`count(*) filter (where ${hasanatDenoms.active} = true)::int`,
      })
      .from(hasanatDenoms)
      .where(eq(hasanatDenoms.workspaceSubdomain, subdomain));

    // Points: join distributions ⋈ denoms (LEFT JOIN; missing denom → 0 points).
    const pointsExpr = sql<number>`coalesce(${hasanatDenoms.points}, 0) * ${hasanatDistributions.quantity}`;
    const [pointsRow] = await tx
      .select({
        totalPointsDistributed: sql<number>`coalesce(sum(${pointsExpr}), 0)::int`,
        pointsThisWeek: sql<number>`coalesce(sum(${pointsExpr}) filter (where ${hasanatDistributions.issuedDate} between ${weekStartStr} and ${weekEndStr}), 0)::int`,
        pointsLastWeek: sql<number>`coalesce(sum(${pointsExpr}) filter (where ${hasanatDistributions.issuedDate} between ${lastWeekStartStr} and ${lastWeekEndStr}), 0)::int`,
      })
      .from(hasanatDistributions)
      .leftJoin(
        hasanatDenoms,
        and(
          eq(hasanatDistributions.workspaceSubdomain, hasanatDenoms.workspaceSubdomain),
          eq(hasanatDistributions.denominationId, hasanatDenoms.id),
        ),
      )
      .where(activeDistributions);

    return {
      totalStock: Number(batchRow?.totalStock ?? 0),
      available: Number(batchRow?.available ?? 0),
      distributed: Number(distRow?.distributed ?? 0),
      redeemed: Number(distRow?.redeemed ?? 0),
      active: Number(distRow?.active ?? 0),
      returned: Number(distRow?.returned ?? 0),
      denominations: Number(denomRow?.denominations ?? 0),
      totalPointsDistributed: Number(pointsRow?.totalPointsDistributed ?? 0),
      pointsThisWeek: Number(pointsRow?.pointsThisWeek ?? 0),
      pointsLastWeek: Number(pointsRow?.pointsLastWeek ?? 0),
    };
  });
}
