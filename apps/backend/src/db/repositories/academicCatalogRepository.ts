import { and, asc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { AcademicCatalogItem, AcademicCatalogKind, AcademicCatalogStatus } from '@mms/shared';
import { programs, sessionCategories, subjects, type AcademicCatalogTable } from '../schema.js';
import { withTenant, withTenantRead, type TenantTransaction } from '../tenant-context.js';
import { enableIncludeDeleted } from '../../lib/softDeleteHelpers.js';
import { ConflictError } from '../../lib/httpErrors.js';
import { recordModernAuditEvent } from '../../services/auditTrailService.js';
import { emitOutboxEvent } from '../../services/outboxEventService.js';
import { countAcademicCatalogReferencesTx } from './academicCatalogReferences.js';

export const ACADEMIC_CATALOG_TABLES: Record<AcademicCatalogKind, { table: AcademicCatalogTable; tableName: string }> = {
  categories: { table: sessionCategories, tableName: 'session_categories' },
  programs: { table: programs, tableName: 'programs' },
  subjects: { table: subjects, tableName: 'subjects' },
};

export interface AcademicCatalogSaveInput {
  id: string;
  name: string;
  code: string | null;
  shortName: string | null;
  status: AcademicCatalogStatus;
  sortOrder?: number;
  actorUserId: string;
}

function columns(table: AcademicCatalogTable) {
  return {
    id: table.id, code: table.code, name: table.name, shortName: table.shortName, status: table.status,
    sortOrder: table.sortOrder, isSystem: table.isSystem, deletedAt: table.deletedAt,
    createdAt: table.createdAt, updatedAt: table.updatedAt,
  };
}

type CatalogSelection = {
  id: string; code: string | null; name: string; shortName: string | null; status: string; sortOrder: number;
  isSystem: boolean; deletedAt: Date | null; createdAt: Date; updatedAt: Date;
};

function toItem(row: CatalogSelection): AcademicCatalogItem {
  return {
    ...row,
    status: row.status === 'archived' ? 'archived' : 'active',
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function selectById(tx: TenantTransaction, kind: AcademicCatalogKind, subdomain: string, id: string) {
  const { table } = ACADEMIC_CATALOG_TABLES[kind];
  const [row] = await tx.select(columns(table)).from(table)
    .where(and(eq(table.workspaceSubdomain, subdomain), eq(table.id, id))).limit(1);
  return row ? toItem(row) : null;
}

async function assertNameAvailable(tx: TenantTransaction, kind: AcademicCatalogKind, subdomain: string, id: string, name: string) {
  const { table } = ACADEMIC_CATALOG_TABLES[kind];
  const [clash] = await tx.select({ id: table.id }).from(table).where(and(
    eq(table.workspaceSubdomain, subdomain), ne(table.id, id), isNull(table.deletedAt),
    sql`lower(btrim(${table.name})) = lower(btrim(${name}))`,
  )).limit(1);
  if (clash) throw new ConflictError(`"${name}" already exists`);
}

export async function listAcademicCatalog(tenant: string, kind: AcademicCatalogKind, includeDeleted = false): Promise<AcademicCatalogItem[]> {
  const subdomain = tenant.trim().toLowerCase();
  const { table } = ACADEMIC_CATALOG_TABLES[kind];
  return withTenantRead(subdomain, async (tx) => {
    if (includeDeleted) await enableIncludeDeleted(tx);
    const scope = includeDeleted
      ? eq(table.workspaceSubdomain, subdomain)
      : and(eq(table.workspaceSubdomain, subdomain), isNull(table.deletedAt));
    const rows = await tx.select(columns(table)).from(table).where(scope)
      .orderBy(asc(table.sortOrder), asc(table.name)).limit(1000);
    return rows.map(toItem);
  });
}

export async function saveAcademicCatalogItem(tenant: string, kind: AcademicCatalogKind, input: AcademicCatalogSaveInput): Promise<AcademicCatalogItem> {
  const subdomain = tenant.trim().toLowerCase();
  const { table, tableName } = ACADEMIC_CATALOG_TABLES[kind];
  return withTenant(subdomain, async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${subdomain}:${tableName}`}))`);
    await assertNameAvailable(tx, kind, subdomain, input.id, input.name);
    const fields = { name: input.name, code: input.code, shortName: input.shortName, status: input.status, updatedBy: input.actorUserId };
    const sortOrder = input.sortOrder ?? (await nextSortOrder(tx, table, subdomain));
    await tx.insert(table)
      .values({ id: input.id, workspaceSubdomain: subdomain, ...fields, sortOrder, createdBy: input.actorUserId })
      .onConflictDoUpdate({
        target: [table.workspaceSubdomain, table.id],
        set: { ...fields, ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }), updatedAt: new Date() },
        setWhere: isNull(table.deletedAt),
      });
    const saved = await selectById(tx, kind, subdomain, input.id);
    if (!saved || saved.deletedAt) throw new ConflictError('Restore this entry before editing it');
    await recordModernAuditEvent(tx, { workspaceSubdomain: subdomain, tableName, recordId: input.id,
      actionType: 'UPDATE', realUserId: input.actorUserId, newState: fields });
    return saved;
  });
}

async function nextSortOrder(tx: TenantTransaction, table: AcademicCatalogTable, subdomain: string): Promise<number> {
  const [row] = await tx.select({ max: sql<number>`coalesce(max(${table.sortOrder}), -1)::int` }).from(table)
    .where(eq(table.workspaceSubdomain, subdomain));
  return Number(row?.max ?? -1) + 1;
}

/** Soft-deletes an entry; 409 while live sessions, classes, periods or exams reference it. Returns false when absent. */
export async function softDeleteAcademicCatalogItem(tenant: string, kind: AcademicCatalogKind, id: string, actorUserId: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const { table, tableName } = ACADEMIC_CATALOG_TABLES[kind];
  return withTenant(subdomain, async (tx) => {
    const references = await countAcademicCatalogReferencesTx(tx, kind, subdomain, id);
    if (references > 0) throw new ConflictError(`In use by ${references} record(s); archive it instead`);
    const deletedAt = new Date();
    const changed = await tx.update(table)
      .set({ deletedAt, deletedBy: actorUserId, deletionReason: 'User deleted', updatedAt: deletedAt, updatedBy: actorUserId })
      .where(and(eq(table.workspaceSubdomain, subdomain), eq(table.id, id), isNull(table.deletedAt)))
      .returning({ id: table.id });
    if (!changed.length) return false;
    await recordModernAuditEvent(tx, { workspaceSubdomain: subdomain, tableName, recordId: id, actionType: 'DELETE', realUserId: actorUserId });
    await emitOutboxEvent(tx, 'entity.soft_deleted', { entityType: tableName, entityId: id, tenantId: subdomain,
      deletedAt: deletedAt.toISOString(), deletedBy: actorUserId, deletionReason: 'User deleted', version: deletedAt.getTime() });
    return true;
  });
}

export async function restoreAcademicCatalogItem(tenant: string, kind: AcademicCatalogKind, id: string, actorUserId: string): Promise<AcademicCatalogItem | null> {
  const subdomain = tenant.trim().toLowerCase();
  const { table, tableName } = ACADEMIC_CATALOG_TABLES[kind];
  return withTenant(subdomain, async (tx) => {
    await enableIncludeDeleted(tx);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${subdomain}:${tableName}`}))`);
    const [current] = await tx.select({ name: table.name }).from(table)
      .where(and(eq(table.workspaceSubdomain, subdomain), eq(table.id, id), isNotNull(table.deletedAt)));
    if (!current) return null;
    await assertNameAvailable(tx, kind, subdomain, id, current.name);
    const now = new Date();
    await tx.update(table)
      .set({ deletedAt: null, deletedBy: null, deletionReason: null, restoredAt: now, restoredBy: actorUserId, updatedAt: now })
      .where(and(eq(table.workspaceSubdomain, subdomain), eq(table.id, id)));
    await recordModernAuditEvent(tx, { workspaceSubdomain: subdomain, tableName, recordId: id, actionType: 'RESTORE', realUserId: actorUserId });
    await emitOutboxEvent(tx, 'entity.restored', { entityType: tableName, entityId: id, tenantId: subdomain,
      restoredAt: now.toISOString(), restoredBy: actorUserId, version: now.getTime() });
    return selectById(tx, kind, subdomain, id);
  });
}
