import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { dedupeTrimmedIds, type Distribution, type RepositoryListOptions } from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { hasanatDistributions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import {
  saveDistribution,
  bulkSaveDistributions,
  replaceDistributionsForWorkspace,
  bulkSoftDeleteDistributions,
  bulkRestoreDistributions,
} from "./hasanatDistributionsPersist.js";

type DistRow = typeof hasanatDistributions.$inferSelect;
export function distributionRowToRecord(row: DistRow): Distribution {
  const dist: Distribution = {
    id: row.id,
    batchId: row.batchId,
    denominationId: row.denominationId,
    denominationName: row.denominationName,
    recipientType: row.recipientType as Distribution["recipientType"],
    recipientName: row.recipientName ?? "",
    recipientClass: row.recipientClass,
    classId: row.classId ?? null,
    quantity: row.quantity,
    reason: row.reason,
    issuedDate: row.issuedDate,
    status: row.status as Distribution["status"],
    ...mapAuditTimestamps(row),
  };

  if (row.recipientStudentId) dist.recipientStudentId = row.recipientStudentId;
  if (row.recipientFacultyId) dist.recipientFacultyId = row.recipientFacultyId;
  if (row.issuedByUserId) dist.issuedByUserId = row.issuedByUserId;
  if (row.issuedBy) dist.issuedBy = row.issuedBy;

  return dist;
}

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

export async function findDistributionById(
  tenant: string,
  id: string,
): Promise<Distribution | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
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
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? distributionRowToRecord(row) : null;
  });
}

export async function findDistributionsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<Distribution[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(hasanatDistributions.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(hasanatDistributions.deletedAt)
          : isNull(hasanatDistributions.deletedAt);

    const conditions = [
      eq(hasanatDistributions.workspaceSubdomain, subdomain),
      inArray(hasanatDistributions.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

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
      .where(and(...conditions));
    return rows.map(distributionRowToRecord);
  });
}

export {
  saveDistribution,
  bulkSaveDistributions,
  replaceDistributionsForWorkspace,
  bulkSoftDeleteDistributions,
  bulkRestoreDistributions,
};
