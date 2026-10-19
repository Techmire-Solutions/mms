import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { applyTitleCaseRecursive } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { tenantUsers } from "../schema.js";
import {
  findTenantUserRowById,
  listAllTenantUsersByWorkspace,
  type TenantUserRow,
} from "./tenantUserRepositoryHydrate.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { tenantUserIdWhere } from "./tenantUserLifecyclePersist.js";
import {
  splitProfileFields,
  omitUndefinedColumns,
  nonEmptyString,
} from "./tenantUserProfileHelpers.js";

export * from "./tenantUserLifecyclePersist.js";
export * from "./tenantUserProfileHelpers.js";


export async function replaceTenantUsersForWorkspace(
  workspaceSubdomain: string,
  users: TenantUserRow[],
): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();

  const dedupedMap = new Map<string, TenantUserRow>();
  for (const u of users) {
    dedupedMap.set(String(u.id), u);
  }
  const uniqueUsers = Array.from(dedupedMap.values());

  // Backup payloads never carry password hashes, so keep the current credential
  // for any account the payload still contains — a restore must not lock admins out.
  const existingRows = await listAllTenantUsersByWorkspace(subdomain);
  const hashById = new Map<string, string>();
  const hashByLoginEmail = new Map<string, string>();
  for (const row of existingRows) {
    const hash = typeof row.passwordHash === "string" ? row.passwordHash : "";
    if (!hash) continue;
    hashById.set(String(row.id), hash);
    if (row.loginEmail) hashByLoginEmail.set(row.loginEmail.trim().toLowerCase(), hash);
  }

  let parkedAnyCredential = false;
  let adminCredentialSurvives = false;
  const values = uniqueUsers.map((user) => {
    const { columns } = splitProfileFields({ ...user, workspaceSubdomain: subdomain });
    if (!columns.passwordHash) {
      columns.passwordHash =
        hashById.get(columns.id) ??
        hashByLoginEmail.get(columns.loginEmail.trim().toLowerCase()) ??
        "";
    }

    if (columns.passwordHash) {
      if (columns.role === "admin" && !columns.deletedAt) adminCredentialSurvives = true;
      return columns;
    }

    // Accounts present in the backup but absent from this workspace have no recoverable
    // credential. Park an unverifiable hash and force a reset instead of failing the
    // whole restore. The value carries no `salt:hash` separator, so `verifyPassword`
    // rejects every candidate password until an admin resets it.
    columns.passwordHash = `!restore-${randomBytes(32).toString("base64url")}`;
    columns.mustChangePassword = true;
    parkedAnyCredential = true;
    return columns;
  });

  // Parking credentials is only safe while at least one live admin can still sign in.
  if (parkedAnyCredential && !adminCredentialSurvives) {
    const err = new Error("backup.missingUserCredentials") as Error & {
      statusCode?: number;
      type?: string;
    };
    err.statusCode = 400;
    err.type = "validation_error";
    throw err;
  }

  await withTenant(subdomain, async (tx) => {
    await tx.delete(tenantUsers).where(eq(tenantUsers.workspaceSubdomain, subdomain));

    if (values.length === 0) return;

    await tx.insert(tenantUsers).values(values);
  });
}

/**
 * Upserts a single tenant user.
 *
 * `workspaceSubdomain` is the CALLER's tenant and is authoritative: the stored
 * workspace always comes from it, never from the payload, so a client cannot
 * pivot a write into another workspace by supplying a foreign id or workspace.
 */
export async function upsertTenantUserRow(
  workspaceSubdomain: string,
  user: TenantUserRow,
): Promise<void> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) {
    throw new Error("[upsertTenantUserRow] workspaceSubdomain is required");
  }
  const processedUser = applyTitleCaseRecursive(user) as TenantUserRow;
  const { columns } = splitProfileFields({ ...processedUser, workspaceSubdomain: tenant });
  const existing = await findTenantUserRowById(tenant, columns.id);

  if (existing) {
    // Contact-linked clients may strip profile fields; never blank auth credentials.
    const merged = {
      ...omitUndefinedColumns(columns),
      workspaceSubdomain: tenant,
      name: nonEmptyString(columns.name) || existing.name || "",
      loginEmail: nonEmptyString(columns.loginEmail) || existing.loginEmail || "",
      passwordHash: nonEmptyString(columns.passwordHash) || existing.passwordHash || "",
      updatedAt: new Date(),
    };
    await withTenant(tenant, async (tx) => {
      await tx.update(tenantUsers).set(merged).where(tenantUserIdWhere(columns.id, tenant));
    });
    await invalidateMultiTierCache({ tenantId: tenant, domain: "users", key: columns.id });
    return;
  }

  await withTenant(tenant, async (tx) => {
    await tx.insert(tenantUsers).values(omitUndefinedColumns(columns) as typeof columns);
  });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "users", key: columns.id });
}

/**
 * Bulk upsert of tenant users.
 *
 * `workspaceSubdomain` is the CALLER's tenant and is authoritative — every row
 * is written into it regardless of any `workspaceSubdomain` present in the
 * payload. Previously the target workspace came from the first payload row
 * (client-controlled) and existing rows kept their own workspace, so a forged
 * payload could address another workspace's rows by id.
 */
export async function upsertTenantUsersBatch(
  workspaceSubdomain: string,
  users: TenantUserRow[],
): Promise<void> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) {
    throw new Error("[upsertTenantUsersBatch] workspaceSubdomain is required");
  }
  if (users.length === 0) return;

  const dedupedMap = new Map<string, TenantUserRow>();
  for (const u of users) {
    dedupedMap.set(String(u.id), u);
  }
  const uniqueUsers = Array.from(dedupedMap.values());

  const processedUsers = uniqueUsers.map((u) => applyTitleCaseRecursive(u) as TenantUserRow);
  const userIds = processedUsers.map((u) => String(u.id));

  await withTenant(tenant, async (tx) => {
    const existingRows = await tx
      .select({
        id: tenantUsers.id,
        workspaceSubdomain: tenantUsers.workspaceSubdomain,
        name: tenantUsers.name,
        loginEmail: tenantUsers.loginEmail,
        passwordHash: tenantUsers.passwordHash,
      })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.workspaceSubdomain, tenant), inArray(tenantUsers.id, userIds)));
    const existingById = new Map(existingRows.map((r) => [String(r.id), r]));

    // Build a single consistent value set for every row (new + existing), then
    // upsert in one query. Semantics are identical to the previous per-user
    // insert/update: empty auth fields fall back to the stored values, and the
    // workspace is always the caller's tenant.
    const values: Array<typeof tenantUsers.$inferInsert> = processedUsers.map((user) => {
      const { columns } = splitProfileFields(user);
      const existing = existingById.get(columns.id);
      return {
        id: columns.id,
        workspaceSubdomain: tenant,
        loginEmail: existing
          ? nonEmptyString(columns.loginEmail) || existing.loginEmail || ""
          : columns.loginEmail,
        passwordHash: existing
          ? nonEmptyString(columns.passwordHash) || existing.passwordHash || ""
          : columns.passwordHash,
        name: existing ? nonEmptyString(columns.name) || existing.name || "" : columns.name,
        role: columns.role,
        contactId: columns.contactId ?? null,
        emailVerifiedAt: columns.emailVerifiedAt ?? null,
        pendingLoginEmail: columns.pendingLoginEmail ?? null,
        mustChangePassword: columns.mustChangePassword ?? false,
        createdAt: columns.createdAt ?? new Date(),
        updatedAt: new Date(),
        deletedAt: columns.deletedAt ?? null,
        deletedBy: columns.deletedBy ?? null,
        profileJson: columns.profileJson ?? null,
      };
    });

    await tx
      .insert(tenantUsers)
      .values(values)
      .onConflictDoUpdate({
        target: [tenantUsers.workspaceSubdomain, tenantUsers.id],
        set: {
          loginEmail: sql.raw("excluded.login_email"),
          passwordHash: sql.raw("excluded.password_hash"),
          name: sql.raw("excluded.name"),
          role: sql.raw("excluded.role"),
          contactId: sql.raw("excluded.contact_id"),
          emailVerifiedAt: sql.raw("excluded.email_verified_at"),
          pendingLoginEmail: sql.raw("excluded.pending_login_email"),
          mustChangePassword: sql.raw("excluded.must_change_password"),
          updatedAt: sql.raw("excluded.updated_at"),
          deletedAt: sql.raw("excluded.deleted_at"),
          deletedBy: sql.raw("excluded.deleted_by"),
          profileJson: sql.raw("excluded.profile_json"),
        },
      });
  });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "users" });
}
