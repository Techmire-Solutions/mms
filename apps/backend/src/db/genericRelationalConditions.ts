import { eq, isNull, isNotNull, type Column, type SQL } from "drizzle-orm";
import type { SoftDeleteListFilter } from "@mms/shared";

export type { SoftDeleteListFilter };

export interface ListByWorkspaceOptions {
  deleted?: SoftDeleteListFilter;
  includeDeleted?: boolean;
}

export interface TenantSoftDeleteTable {
  workspaceSubdomain: Column;
  deletedAt: Column;
}

export interface GenericServiceRepo<T> {
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
