import { randomUUID } from "node:crypto";
import { dedupeTrimmedIds, type SoftDeleteFields, type SoftDeleteListFilter } from "@mms/shared";
import { eq, isNull, isNotNull, type Column, type SQL } from "drizzle-orm";
import { getRequestTenant } from "../lib/tenantContext.js";
import { ConflictError, NotFoundError } from "../lib/httpErrors.js";
import type { ZodType } from "zod";

export type { SoftDeleteListFilter };

export interface ListByWorkspaceOptions {
  deleted?: SoftDeleteListFilter;
  includeDeleted?: boolean;
}

export interface TenantSoftDeleteTable {
  workspaceSubdomain: Column;
  deletedAt: Column;
}

/**
 * Builds mandatory tenant and soft-delete SQL conditions with dynamic AST construction.
 * Enforces mandatory tenant predicate `eq(table.workspaceSubdomain, tenant)`.
 * Matches Category B partial index for 'active', Category C for 'deleted'.
 */
export function buildTenantSoftDeleteConditions<TTable extends TenantSoftDeleteTable>(
  table: TTable,
  tenant: string,
  filter: SoftDeleteListFilter = "active",
): SQL[] {
  const subdomain = tenant.trim().toLowerCase();
  const conditions: SQL[] = [eq(table.workspaceSubdomain, subdomain)];
  if (filter === "deleted") {
    conditions.push(isNotNull(table.deletedAt));
  } else if (filter === "active") {
    conditions.push(isNull(table.deletedAt));
  }
  // 'all' includes both active and deleted rows while keeping tenant isolation strictly intact.
  return conditions;
}

/**
 * @deprecated In-memory soft-delete filtering is banned for relational SQL modules per mms-data-layer.md §6.
 * Use `buildTenantSoftDeleteConditions` or database-level queries matching partial indexes.
 */
export function filterInMemorySoftDeleted<T extends { deletedAt?: string | Date | null }>(
  records: T[],
  filter: SoftDeleteListFilter = "active",
): T[] {
  if (filter === "deleted") {
    return records.filter((r) => Boolean(r.deletedAt));
  }
  if (filter === "active") {
    return records.filter((r) => !r.deletedAt);
  }
  return records;
}

export interface GenericServiceOptions<T> {
  repo: {
    listByWorkspace: (subdomain: string, options?: ListByWorkspaceOptions) => Promise<T[]>;
    findById: (
      subdomain: string,
      id: string,
      options?: { includeDeleted?: boolean },
    ) => Promise<T | null>;
    save: (subdomain: string, record: T) => Promise<void>;
    deleteById?: (
      subdomain: string,
      id: string,
      deletedBy: string,
      deletionReason?: string,
    ) => Promise<boolean>;
    restoreById?: (subdomain: string, id: string, userId?: string) => Promise<boolean>;
    bulkDelete?: (
      subdomain: string,
      ids: string[],
      deletedBy: string,
      deletionReason?: string,
    ) => Promise<{ succeeded: number; failed: number }>;
    bulkRestore?: (
      subdomain: string,
      ids: string[],
      userId?: string,
    ) => Promise<{ succeeded: number; failed: number }>;
  };
  schema?: ZodType<T>;
  websocketCollection: string;
  idPrefix: string;
  normalizeFn?: (record: T) => T;
}

/**
 * Creates a generic set of CRUD functions for a relational database collection.
 */
export function createGenericRelationalService<
  T extends SoftDeleteFields & {
    id?: string | number;
  },
>(options: GenericServiceOptions<T>) {
  const { repo, schema, websocketCollection, idPrefix, normalizeFn } = options;

  async function loadAll(opts?: { includeDeleted?: boolean }): Promise<T[]> {
    const tenant = getRequestTenant();
    if (!tenant) return [];
    // includeDeleted matches Contacts: trash = deleted-only (not active+deleted).
    return repo.listByWorkspace(tenant, {
      deleted: opts?.includeDeleted ? "deleted" : "active",
    });
  }

  async function loadById(id: string, includeDeleted = false): Promise<T | null> {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const existing = await repo.findById(tenant, id, { includeDeleted });
    if (!existing) return null;
    if (!includeDeleted && existing.deletedAt) return null;
    return existing;
  }

  async function create(record: T): Promise<T> {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    const resolvedId =
      typeof record.id === "string" && record.id.trim() !== ""
        ? record.id.trim()
        : typeof record.id === "number" && Number.isFinite(record.id)
          ? String(record.id)
          : `${idPrefix}-${randomUUID()}`;
    const prepared = { ...record, id: resolvedId } as T;
    const parsed = schema ? (schema.parse(prepared) as T) : prepared;
    const normalized = normalizeFn ? normalizeFn(parsed) : parsed;
    await repo.save(tenant, normalized);
    const { broadcastTenantUpdate } = await import("./websocketService.js");
    broadcastTenantUpdate(tenant, "collection", websocketCollection);
    return normalized;
  }

  async function updateById(id: string, record: Partial<T>): Promise<T | null> {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const existing = await repo.findById(tenant, id);
    if (!existing || existing.deletedAt) return null;
    const merged = { ...existing };
    for (const [key, value] of Object.entries(record)) {
      if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
    }
    const withId = { ...merged, id } as T;
    const parsed = schema ? (schema.parse(withId) as T) : withId;
    const normalized = normalizeFn ? normalizeFn(parsed) : parsed;
    await repo.save(tenant, normalized);
    const { broadcastTenantUpdate } = await import("./websocketService.js");
    broadcastTenantUpdate(tenant, "collection", websocketCollection);
    return normalized;
  }

  async function deleteById(
    id: string,
    deletedBy: string,
    deletionReason?: string,
  ): Promise<boolean> {
    const tenant = getRequestTenant();
    if (!tenant) return false;

    if (repo.deleteById) {
      const ok = await repo.deleteById(tenant, id, deletedBy, deletionReason);
      if (ok) {
        const { broadcastTenantUpdate } = await import("./websocketService.js");
        broadcastTenantUpdate(tenant, "collection", websocketCollection);
        return true;
      }
      const existing = await repo.findById(tenant, id, { includeDeleted: true });
      if (existing?.deletedAt) {
        throw new NotFoundError(`${idPrefix} is already archived`);
      }
      throw new NotFoundError(`${idPrefix} not found`);
    }

    if (repo.bulkDelete) {
      const res = await repo.bulkDelete(tenant, [id], deletedBy, deletionReason);
      if (res.succeeded === 1) {
        const { broadcastTenantUpdate } = await import("./websocketService.js");
        broadcastTenantUpdate(tenant, "collection", websocketCollection);
        return true;
      }
      const existing = await repo.findById(tenant, id, { includeDeleted: true });
      if (existing?.deletedAt) {
        throw new NotFoundError(`${idPrefix} is already archived`);
      }
      throw new NotFoundError(`${idPrefix} not found`);
    }

    const existing = await repo.findById(tenant, id, { includeDeleted: true });
    if (!existing) {
      throw new NotFoundError(`${idPrefix} not found`);
    }
    if (existing.deletedAt) {
      throw new NotFoundError(`${idPrefix} is already archived`);
    }
    const updated = {
      ...existing,
      deletedAt: new Date().toISOString(),
      deletedBy,
      deletionReason: deletionReason || undefined,
    } as T;
    await repo.save(tenant, updated);
    const { broadcastTenantUpdate } = await import("./websocketService.js");
    broadcastTenantUpdate(tenant, "collection", websocketCollection);
    return true;
  }

  async function restoreById(id: string, userId?: string): Promise<boolean> {
    const tenant = getRequestTenant();
    if (!tenant) return false;

    if (repo.restoreById) {
      const ok = await repo.restoreById(tenant, id, userId);
      if (ok) {
        const { broadcastTenantUpdate } = await import("./websocketService.js");
        broadcastTenantUpdate(tenant, "collection", websocketCollection);
        return true;
      }
      const existing = await repo.findById(tenant, id, { includeDeleted: true });
      if (existing && !existing.deletedAt) {
        throw new NotFoundError(`${idPrefix} is already active`);
      }
      throw new NotFoundError(`${idPrefix} not found`);
    }

    if (repo.bulkRestore) {
      const res = await repo.bulkRestore(tenant, [id], userId);
      if (res.succeeded === 1) {
        const { broadcastTenantUpdate } = await import("./websocketService.js");
        broadcastTenantUpdate(tenant, "collection", websocketCollection);
        return true;
      }
      const existing = await repo.findById(tenant, id, { includeDeleted: true });
      if (existing && !existing.deletedAt) {
        throw new NotFoundError(`${idPrefix} is already active`);
      }
      throw new NotFoundError(`${idPrefix} not found`);
    }

    const existing = await repo.findById(tenant, id, { includeDeleted: true });
    if (!existing) {
      throw new NotFoundError(`${idPrefix} not found`);
    }
    if (!existing.deletedAt) {
      throw new NotFoundError(`${idPrefix} is already active`);
    }
    const restored = {
      ...existing,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: new Date().toISOString(),
      restoredBy: userId ?? null,
    } as T;
    try {
      await repo.save(tenant, restored);
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: unknown }).code === "23505"
      ) {
        throw new ConflictError(
          `Cannot restore ${idPrefix}: active record with this unique identifier already exists`,
        );
      }
      throw err;
    }
    const { broadcastTenantUpdate } = await import("./websocketService.js");
    broadcastTenantUpdate(tenant, "collection", websocketCollection);
    return true;
  }

  async function bulkDeleteByIds(
    ids: string[],
    deletedBy: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }> {
    const uniqueIds = dedupeTrimmedIds(ids);
    if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
    const tenant = getRequestTenant();
    if (repo.bulkDelete && tenant) {
      const result = await repo.bulkDelete(tenant, uniqueIds, deletedBy, deletionReason);
      if (result.succeeded > 0) {
        const { broadcastTenantUpdate } = await import("./websocketService.js");
        broadcastTenantUpdate(tenant, "collection", websocketCollection);
      }
      return result;
    }
    let succeeded = 0;
    let failed = 0;
    for (const id of uniqueIds) {
      try {
        const ok = await deleteById(id, deletedBy, deletionReason);
        if (ok) succeeded += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    return { succeeded, failed };
  }

  async function bulkRestoreByIds(
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }> {
    const uniqueIds = dedupeTrimmedIds(ids);
    if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
    const tenant = getRequestTenant();
    if (repo.bulkRestore && tenant) {
      const result = await repo.bulkRestore(tenant, uniqueIds, userId);
      if (result.succeeded > 0) {
        const { broadcastTenantUpdate } = await import("./websocketService.js");
        broadcastTenantUpdate(tenant, "collection", websocketCollection);
      }
      return result;
    }
    let succeeded = 0;
    let failed = 0;
    for (const id of uniqueIds) {
      const ok = await restoreById(id, userId);
      if (ok) succeeded += 1;
      else failed += 1;
    }
    return { succeeded, failed };
  }

  return {
    loadAll,
    loadById,
    create,
    updateById,
    deleteById,
    restoreById,
    bulkDeleteByIds,
    bulkRestoreByIds,
  };
}
