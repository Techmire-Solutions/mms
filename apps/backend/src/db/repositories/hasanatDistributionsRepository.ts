/**
 * Hasanat distributions repository: workspace listing, plus the mapper, lookup and
 * persist units re-exported so the public import surface stays unchanged (ADR-001).
 */

import { and } from "drizzle-orm";
import { type Distribution, type RepositoryListOptions } from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { hasanatDistributions } from "../schema.js";
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
      .select({
        id: hasanatDistributions.id,
        workspaceSubdomain: hasanatDistributions.workspaceSubdomain,
        batchId: hasanatDistributions.batchId,
        denominationId: hasanatDistributions.denominationId,
        denominationName: hasanatDistributions.denominationName,
        recipientType: hasanatDistributions.recipientType,
        recipientStudentId: hasanatDistributions.recipientStudentId,
        recipientFacultyId: hasanatDistributions.recipientFacultyId,
        recipientName: hasanatDistributions.recipientName,
        recipientClass: hasanatDistributions.recipientClass,
        classId: hasanatDistributions.classId,
        quantity: hasanatDistributions.quantity,
        reason: hasanatDistributions.reason,
        issuedDate: hasanatDistributions.issuedDate,
        issuedByUserId: hasanatDistributions.issuedByUserId,
        issuedBy: hasanatDistributions.issuedBy,
        status: hasanatDistributions.status,
        deletedAt: hasanatDistributions.deletedAt,
        deletedBy: hasanatDistributions.deletedBy,
        deletionReason: hasanatDistributions.deletionReason,
        restoredAt: hasanatDistributions.restoredAt,
        restoredBy: hasanatDistributions.restoredBy,
        deletedWithCascade: hasanatDistributions.deletedWithCascade,
        createdAt: hasanatDistributions.createdAt,
        updatedAt: hasanatDistributions.updatedAt,
      })
      .from(hasanatDistributions)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    return rows.map(distributionRowToRecord);
  });
}
