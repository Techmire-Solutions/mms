/**
 * Hasanat distribution point lookups by id and by id set.
 */

import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { dedupeTrimmedIds, type Distribution } from "@mms/shared";
import { hasanatDistributions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { distributionRowToRecord } from "./hasanatDistributionsMappers.js";

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
