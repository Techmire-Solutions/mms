import type { ZodType } from "zod";
import { getRequestTenant } from "../lib/tenantContext.js";
import { broadcastCollection } from "../lib/livePush.js";

interface TenantBulkRepo<T> {
  listByWorkspace: (subdomain: string) => Promise<T[]>;
  replaceForWorkspace: (subdomain: string, records: T[]) => Promise<void>;
}

/**
 * @deprecated Legacy in-memory soft-delete filter for collection-store backed modules only.
 * Banned for SQL-backed modules per mms-performance.md §1 and mms-data-layer.md §6.
 * SQL modules must filter at the database layer (WHERE deleted_at IS NULL / IS NOT NULL).
 */
export function scopeDeleted<T extends { deletedAt?: string | null }>(
  rows: T[],
  includeDeleted?: boolean,
): T[] {
  if (includeDeleted) return rows.filter((row) => Boolean(row.deletedAt));
  return rows.filter((row) => !row.deletedAt);
}

export interface BulkOperationOptions {
  skipValidation?: boolean;
}

/**
 * Parses, bulk-saves, and broadcasts a tenant collection upsert.
 */
export async function upsertWithBroadcast<T>(
  schema: { parse: (data: unknown) => T[] } | null | undefined,
  records: T[],
  bulkSave: (tenant: string, list: T[]) => Promise<void>,
  collection: string,
  options?: BulkOperationOptions,
): Promise<T[]> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  const parsed = schema && !options?.skipValidation ? schema.parse(records) : records;
  await bulkSave(tenant, parsed);
  await broadcastCollection(collection);
  return parsed;
}

/**
 * Generates a `load()` and `replace()` function pair for a tenant-scoped
 * collection that is managed via bulk replace (GET all / PUT all).
 *
 * Prefer {@link upsertWithBroadcast} for API bulk write paths.
 */
export function defineTenantBulkCollectionService<T>(
  repo: TenantBulkRepo<T>,
  schema: ZodType<T[]> | null | undefined,
  broadcastKey: string,
) {
  async function load(): Promise<T[]> {
    const tenant = getRequestTenant();
    if (!tenant) return [];
    return repo.listByWorkspace(tenant);
  }

  async function replace(records: T[], options?: BulkOperationOptions): Promise<T[]> {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    const parsed = schema && !options?.skipValidation ? schema.parse(records) : records;
    await repo.replaceForWorkspace(tenant, parsed);
    await broadcastCollection(broadcastKey);
    return parsed;
  }

  return { load, replace };
}
