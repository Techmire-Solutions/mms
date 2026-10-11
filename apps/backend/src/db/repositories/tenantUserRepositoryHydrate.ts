import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type StoredTenantUser } from "@mms/shared";
import { withTenantRead, withGlobalTenant } from "../tenant-context.js";
import { tenantUsers } from "../schema.js";
import { mapAuditTimestamps, toIsoString } from "./repositoryMappers.js";
import { getPreparedTenantUserById } from "../preparedStatements.js";

export type TenantUserRow = StoredTenantUser & Record<string, unknown>;

export function rowToTenantUser(row: typeof tenantUsers.$inferSelect): TenantUserRow {
  const audit = mapAuditTimestamps(row);
  const base: TenantUserRow = {
    id: row.id,
    workspaceSubdomain: row.workspaceSubdomain,
    loginEmail: row.loginEmail,
    // Workspace UI reads `email`; auth column is `loginEmail`.
    email: row.loginEmail,
    passwordHash: row.passwordHash,
    name: row.name,
    role: row.role,
    createdAt:
      audit.createdAt ??
      (row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)),
    mustChangePassword: row.mustChangePassword,
    deletedAt: audit.deletedAt ?? null,
    deletedBy: audit.deletedBy ?? null,
  };

  if (row.contactId) base.contactId = row.contactId;
  if (row.emailVerifiedAt) base.emailVerifiedAt = toIsoString(row.emailVerifiedAt);
  if (row.pendingLoginEmail) base.pendingLoginEmail = row.pendingLoginEmail;

  if (row.profileJson) {
    const extra = row.profileJson as Record<string, unknown>;
    // Auth/soft-delete columns win over profile_json mirrors.
    return { ...extra, ...base };
  }

  return base;
}

/** Shared projection for tenant-user reads (kept in one place to avoid drift). */
const tenantUserColumns = {
  id: tenantUsers.id,
  workspaceSubdomain: tenantUsers.workspaceSubdomain,
  loginEmail: tenantUsers.loginEmail,
  passwordHash: tenantUsers.passwordHash,
  name: tenantUsers.name,
  role: tenantUsers.role,
  contactId: tenantUsers.contactId,
  emailVerifiedAt: tenantUsers.emailVerifiedAt,
  pendingLoginEmail: tenantUsers.pendingLoginEmail,
  mustChangePassword: tenantUsers.mustChangePassword,
  createdAt: tenantUsers.createdAt,
  updatedAt: tenantUsers.updatedAt,
  deletedAt: tenantUsers.deletedAt,
  deletedBy: tenantUsers.deletedBy,
  deletionReason: tenantUsers.deletionReason,
  restoredAt: tenantUsers.restoredAt,
  restoredBy: tenantUsers.restoredBy,
  deletedWithCascade: tenantUsers.deletedWithCascade,
  profileJson: tenantUsers.profileJson,
} as const;

/**
 * Loads tenant users by id **within one workspace**.
 *
 * The workspace predicate is mandatory. `tenant_users` carries a row-level
 * security policy that permits every row whenever `app.rls_bypass = 'on'`, and
 * that flag is set for any transaction opened without a tenant — so an
 * id-only lookup is NOT implicitly tenant-safe and must not be relied upon.
 * @see withTenant in ../tenant-context.ts
 */
export async function listTenantUsersByIds(
  workspaceSubdomain: string,
  ids: string[],
): Promise<TenantUserRow[]> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  if (!subdomain) return [];
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return [];
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(tenantUserColumns)
      .from(tenantUsers)
      .where(
        and(eq(tenantUsers.workspaceSubdomain, subdomain), inArray(tenantUsers.id, uniqueIds)),
      );
    return rows.map(rowToTenantUser);
  });
}

/**
 * Platform/global variant of {@link listTenantUsersByIds}: intentionally reads
 * across every workspace. Only call from platform-admin routes, migrations, or
 * backup/restore paths — never from a tenant-scoped route.
 */
export async function listTenantUsersByIdsGlobal(ids: string[]): Promise<TenantUserRow[]> {
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return [];
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .select(tenantUserColumns)
      .from(tenantUsers)
      .where(inArray(tenantUsers.id, uniqueIds));
    return rows.map(rowToTenantUser);
  });
}

export async function countTenantUsersByWorkspace(workspaceSubdomain: string): Promise<number> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ count: sql<string>`count(*)` })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.workspaceSubdomain, subdomain), isNull(tenantUsers.deletedAt)));
    return parseInt(rows[0]?.count ?? "0", 10);
  });
}

export async function listTenantUsersByWorkspace(
  workspaceSubdomain: string,
  options?: { includeDeleted?: boolean; limit?: number; offset?: number },
): Promise<TenantUserRow[]> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const includeDeleted = options?.includeDeleted === true;
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(tenantUserColumns)
      .from(tenantUsers)
      .where(
        includeDeleted
          ? and(
              eq(tenantUsers.workspaceSubdomain, subdomain),
              sql`${tenantUsers.deletedAt} is not null`,
            )
          : and(eq(tenantUsers.workspaceSubdomain, subdomain), isNull(tenantUsers.deletedAt)),
      )
      .limit(limit)
      .offset(offset);
    return rows.map(rowToTenantUser);
  });
}

/** Every workspace row, active and soft-deleted — backup snapshots and restore merges. */
export async function listAllTenantUsersByWorkspace(
  workspaceSubdomain: string,
): Promise<TenantUserRow[]> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(tenantUserColumns)
      .from(tenantUsers)
      .where(eq(tenantUsers.workspaceSubdomain, subdomain));
    return rows.map(rowToTenantUser);
  });
}

/**
 * Loads a single tenant user by id **within one workspace**.
 *
 * The workspace predicate is mandatory — see {@link listTenantUsersByIds} for
 * why an id-only lookup is not tenant-safe.
 */
export async function findTenantUserRowById(
  workspaceSubdomain: string,
  id: string,
): Promise<TenantUserRow | null> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const cleanId = id?.trim();
  if (!subdomain || !cleanId) return null;
  return withTenantRead(subdomain, async (tx) => {
    let row: typeof tenantUsers.$inferSelect | undefined;
    if (
      process.env.MMS_USE_PREPARED_STATEMENTS !== "false" &&
      typeof (tx as { execute?: unknown }).execute === "function" &&
      (tx as { dialect?: unknown }).dialect !== undefined
    ) {
      try {
        const stmt = getPreparedTenantUserById(tx);
        if (stmt && typeof stmt.execute === "function") {
          const rows = await stmt.execute({ subdomain, id: cleanId });
          row = rows[0];
        }
      } catch {
        // Fallback to standard select
      }
    }
    if (!row) {
      const rows = await tx
        .select(tenantUserColumns)
        .from(tenantUsers)
        .where(and(eq(tenantUsers.workspaceSubdomain, subdomain), eq(tenantUsers.id, cleanId)));
      row = rows[0];
    }
    return row ? rowToTenantUser(row) : null;
  });
}

/**
 * Active (non-deleted) tenant user linked to a contact in one workspace.
 * Returns the first match when multiple rows share a contact id.
 */
export async function findTenantUserRowByContactId(
  workspaceSubdomain: string,
  contactId: string,
): Promise<TenantUserRow | null> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const cleanContactId = contactId?.trim();
  if (!subdomain || !cleanContactId) return null;
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(tenantUserColumns)
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.workspaceSubdomain, subdomain),
          eq(tenantUsers.contactId, cleanContactId),
          isNull(tenantUsers.deletedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToTenantUser(row) : null;
  });
}

/**
 * Platform/global variant of {@link findTenantUserRowById}: intentionally
 * resolves a user regardless of workspace. Only call from platform-admin
 * routes, auth bootstrap, or migrations — never from a tenant-scoped route.
 */
export async function findTenantUserRowByIdGlobal(id: string): Promise<TenantUserRow | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .select(tenantUserColumns)
      .from(tenantUsers)
      .where(eq(tenantUsers.id, cleanId));
    const row = rows[0];
    return row ? rowToTenantUser(row) : null;
  });
}
