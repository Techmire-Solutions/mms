import { and, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import { dedupeTrimmedIds, type Distribution, type RepositoryListOptions } from '@mms/shared';
import { buildTenantSoftDeleteConditions } from '../../services/genericRelationalService.js';
import { hasanatDistributions } from '../schema.js';
import { withTenant, withTenantRead } from '../tenant-context.js';
import { mapAuditTimestamps } from './repositoryMappers.js';

type DistRow = typeof hasanatDistributions.$inferSelect;
export function distributionRowToRecord(row: DistRow): Distribution {
  const dist: Distribution = {
    id: row.id,
    batchId: row.batchId,
    denominationId: row.denominationId,
    denominationName: row.denominationName,
    recipientType: row.recipientType as Distribution['recipientType'],
    recipientName: row.recipientName ?? '',
    recipientClass: row.recipientClass,
    classId: row.classId ?? null,
    quantity: row.quantity,
    reason: row.reason,
    issuedDate: row.issuedDate,
    status: row.status as Distribution['status'],
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
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? 'all' : 'active');
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(hasanatDistributions, subdomain, deletedFilter);
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

export async function findDistributionById(tenant: string, id: string): Promise<Distribution | null> {
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
  options?: { deleted?: 'active' | 'deleted' | 'all'; includeDeleted?: boolean },
): Promise<Distribution[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === 'deleted';
    const isAll = options?.deleted === 'all';
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

export async function saveDistribution(tenant: string, record: Distribution): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(hasanatDistributions)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        batchId: record.batchId,
        denominationId: record.denominationId,
        denominationName: record.denominationName ?? '',
        recipientType: record.recipientType ?? 'student',
        recipientStudentId: record.recipientStudentId ?? null,
        recipientFacultyId: record.recipientFacultyId ?? null,
        recipientName: record.recipientName ?? '',
        recipientClass: record.recipientClass ?? '',
        classId: record.classId ?? null,
        quantity: record.quantity ?? 1,
        reason: record.reason ?? '',
        issuedDate: record.issuedDate,
        issuedByUserId: record.issuedByUserId ?? null,
        issuedBy: record.issuedBy ?? null,
        status: record.status ?? 'active',
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.id],
        set: {
          batchId: record.batchId,
          denominationId: record.denominationId,
          denominationName: record.denominationName ?? '',
          recipientType: record.recipientType ?? 'student',
          recipientStudentId: record.recipientStudentId ?? null,
          recipientFacultyId: record.recipientFacultyId ?? null,
          recipientName: record.recipientName ?? '',
          recipientClass: record.recipientClass ?? '',
          classId: record.classId ?? null,
          quantity: record.quantity ?? 1,
          reason: record.reason ?? '',
          issuedDate: record.issuedDate,
          issuedByUserId: record.issuedByUserId ?? null,
          issuedBy: record.issuedBy ?? null,
          status: record.status ?? 'active',
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveDistributions(tenant: string, records: Distribution[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Distribution>();
  for (const r of records) {
    const cleanId = typeof r.id === 'string' ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(hasanatDistributions)
      .values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          batchId: r.batchId,
          denominationId: r.denominationId,
          denominationName: r.denominationName ?? '',
          recipientType: r.recipientType ?? 'student',
          recipientStudentId: r.recipientStudentId ?? null,
          recipientFacultyId: r.recipientFacultyId ?? null,
          recipientName: r.recipientName ?? '',
          recipientClass: r.recipientClass ?? '',
          classId: r.classId ?? null,
          quantity: r.quantity ?? 1,
          reason: r.reason ?? '',
          issuedDate: r.issuedDate,
          issuedByUserId: r.issuedByUserId ?? null,
          issuedBy: r.issuedBy ?? null,
          status: r.status ?? 'active',
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.id],
        set: {
          batchId: sql`excluded.batch_id`,
          denominationId: sql`excluded.denomination_id`,
          denominationName: sql`excluded.denomination_name`,
          recipientType: sql`excluded.recipient_type`,
          recipientStudentId: sql`excluded.recipient_student_id`,
          recipientFacultyId: sql`excluded.recipient_faculty_id`,
          recipientName: sql`excluded.recipient_name`,
          recipientClass: sql`excluded.recipient_class`,
          classId: sql`excluded.class_id`,
          quantity: sql`excluded.quantity`,
          reason: sql`excluded.reason`,
          issuedDate: sql`excluded.issued_date`,
          issuedByUserId: sql`excluded.issued_by_user_id`,
          issuedBy: sql`excluded.issued_by`,
          status: sql`excluded.status`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceDistributionsForWorkspace(tenant: string, records: Distribution[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Distribution>();
  for (const r of records) {
    const cleanId = typeof r.id === 'string' ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(hasanatDistributions).where(eq(hasanatDistributions.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(hasanatDistributions).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          batchId: r.batchId,
          denominationId: r.denominationId,
          denominationName: r.denominationName ?? '',
          recipientType: r.recipientType ?? 'student',
          recipientStudentId: r.recipientStudentId ?? null,
          recipientFacultyId: r.recipientFacultyId ?? null,
          recipientName: r.recipientName ?? '',
          recipientClass: r.recipientClass ?? '',
          classId: r.classId ?? null,
          quantity: r.quantity ?? 1,
          reason: r.reason ?? '',
          issuedDate: r.issuedDate,
          issuedByUserId: r.issuedByUserId ?? null,
          issuedBy: r.issuedBy ?? null,
          status: r.status ?? 'active',
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      );
    }
  });
}

export async function bulkSoftDeleteDistributions(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(hasanatDistributions)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          inArray(hasanatDistributions.id, uniqueIds),
          isNull(hasanatDistributions.deletedAt),
        ),
      )
      .returning({ id: hasanatDistributions.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreDistributions(
  tenant: string,
  ids: string[],
  _userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(hasanatDistributions)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          inArray(hasanatDistributions.id, uniqueIds),
          isNotNull(hasanatDistributions.deletedAt),
        ),
      )
      .returning({ id: hasanatDistributions.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
