/**
 * Paginated ledger history — bounded, newest first, filtered server-side.
 *
 * The ledger is the module's audit surface; returning every row (the previous behaviour) grew with
 * the tenant. This read model is capped at `LIST_PAGE_MAX_LIMIT` (100) with a default of 50.
 */

import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { Redemption } from "@mms/shared";
import { hasanatDistributions, hasanatRedemptions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { redemptionColumns } from "./hasanatColumns.js";
import { redemptionRowToRecord } from "./hasanatRedemptionsRepository.js";

export interface RedemptionsPageQuery {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  kind?: "redeem" | "reversal";
  studentId?: string;
  distributionId?: string;
}

export interface RedemptionsPageResult {
  redemptions: Redemption[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function listRedemptionsPage(
  tenant: string,
  query: RedemptionsPageQuery = {},
): Promise<RedemptionsPageResult> {
  const subdomain = tenant.trim().toLowerCase();
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(Math.max(Math.floor(query.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const offset = (page - 1) * limit;

  return withTenantRead(subdomain, async (tx) => {
    // A trashed card must not surface its ledger rows.
    const conditions = [
      eq(hasanatRedemptions.workspaceSubdomain, subdomain),
      isNull(hasanatDistributions.deletedAt),
    ];
    if (query.from?.trim()) conditions.push(gte(hasanatRedemptions.date, query.from.trim()));
    if (query.to?.trim()) conditions.push(lte(hasanatRedemptions.date, query.to.trim()));
    if (query.kind) conditions.push(eq(hasanatRedemptions.kind, query.kind));
    if (query.studentId?.trim()) {
      conditions.push(eq(hasanatRedemptions.studentId, query.studentId.trim()));
    }
    if (query.distributionId?.trim()) {
      conditions.push(eq(hasanatRedemptions.distributionId, query.distributionId.trim()));
    }
    const where = and(...conditions);

    const parentJoin = and(
      eq(hasanatDistributions.workspaceSubdomain, hasanatRedemptions.workspaceSubdomain),
      eq(hasanatDistributions.id, hasanatRedemptions.distributionId),
    );

    const [countRow] = await tx
      .select({ total: count() })
      .from(hasanatRedemptions)
      .innerJoin(hasanatDistributions, parentJoin)
      .where(where);

    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      .innerJoin(hasanatDistributions, parentJoin)
      .where(where)
      .orderBy(desc(hasanatRedemptions.createdAt))
      .limit(limit)
      .offset(offset);

    const total = Number(countRow?.total ?? 0);
    return {
      redemptions: rows.map(redemptionRowToRecord),
      total,
      page,
      limit,
      hasMore: offset + rows.length < total,
    };
  });
}
