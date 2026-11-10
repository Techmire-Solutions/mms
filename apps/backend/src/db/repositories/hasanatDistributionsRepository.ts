/**
 * Hasanat distributions repository: workspace listing, plus the mapper, lookup and
 * persist units re-exported so the public import surface stays unchanged (ADR-001).
 */

import { and } from "drizzle-orm";
import { type Distribution, type RepositoryListOptions } from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { hasanatDistributions } from "../schema.js";
import { distributionColumns } from "./hasanatColumns.js";
import { withTenantRead } from "../tenant-context.js";
import { distributionRowToRecord } from "./hasanatDistributionsMappers.js";

export { distributionRowToRecord } from "./hasanatDistributionsMappers.js";
export { findDistributionById, findDistributionsByIds } from "./hasanatDistributionsQueries.js";
export {
  saveDistribution,
  bulkSaveDistributions,
  replaceDistributionsForWorkspace,
  bulkSoftDeleteDistributions,
  bulkRestoreDistributions,
} from "./hasanatDistributionsPersist.js";

export type ListDistributionsOptions = RepositoryListOptions;

export async function listDistributionsByWorkspace(
  tenant: string,
  options?: ListDistributionsOptions,
): Promise<Distribution[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 1000, 1), 10000);
  const offset = Math.max(options?.offset ?? 0, 0);
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(
      hasanatDistributions,
      subdomain,
      deletedFilter,
    );
    const rows = await tx
      .select(distributionColumns)
      .from(hasanatDistributions)
      .where(and(...conditions))
      .orderBy(hasanatDistributions.id)
      .limit(limit)
      .offset(offset);
    return rows.map(distributionRowToRecord);
  });
}
