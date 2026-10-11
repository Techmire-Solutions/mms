import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { resolveTenantLoginEmail, applyTitleCaseRecursive } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { tenantUsers } from "../schema.js";
import {
  findTenantUserRowById,
  findTenantUserRowByIdGlobal,
  listAllTenantUsersByWorkspace,
  type TenantUserRow,
} from "./tenantUserRepositoryHydrate.js";
import { revokeAllUserSessions, revokeUserSessionKeys } from "../../services/session.service.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

const TABLE_AUTH_KEYS = new Set([
  "id",
  "workspaceSubdomain",
  "loginEmail",
  "passwordHash",
  "name",
  "role",
  "contactId",
  "emailVerifiedAt",
  "pendingLoginEmail",
  "createdAt",
  "email",
  "mustChangePassword",
  "deletedAt",
  "deletedBy",
]);

function splitProfileFields(user: TenantUserRow): {
  columns: typeof tenantUsers.$inferInsert;
  profile: Record<string, unknown>;
} {
  const profile: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(user)) {
    if (!TABLE_AUTH_KEYS.has(key) && value !== undefined) {
      profile[key] = value;
    }
  }

  const loginEmail = resolveTenantLoginEmail(
    user,
    typeof user.email === "string" ? user.email : undefined,
  );
  const workspaceSubdomain =
    typeof user.workspaceSubdomain === "string" ? user.workspaceSubdomain.trim().toLowerCase() : "";

  return {
    columns: {
      id: String(user.id),
      workspaceSubdomain,
      loginEmail,
      passwordHash: typeof user.passwordHash === "string" ? user.passwordHash : "",
      name: typeof user.name === "string" ? user.name : "",
      role: typeof user.role === "string" ? user.role : "assistant_teacher",
      contactId: user.contactId != null && user.contactId !== "" ? String(user.contactId) : null,
      emailVerifiedAt:
        typeof user.emailVerifiedAt === "string" ? new Date(user.emailVerifiedAt) : null,
      pendingLoginEmail:
        typeof user.pendingLoginEmail === "string" ? user.pendingLoginEmail.toLowerCase() : null,
      createdAt: typeof user.createdAt === "string" ? new Date(user.createdAt) : new Date(),
      mustChangePassword: user.mustChangePassword === true,
      deletedAt:
        typeof user.deletedAt === "string" && user.deletedAt
          ? new Date(user.deletedAt)
          : user.deletedAt === null
            ? null
            : undefined,
      deletedBy:
        typeof user.deletedBy === "string" && user.deletedBy
          ? user.deletedBy
          : user.deletedBy === null
            ? null
            : undefined,
      profileJson: Object.keys(profile).length > 0 ? profile : null,
    },
    profile,
  };
}

function omitUndefinedColumns<T extends Record<string, unknown>>(columns: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in columns) {
    if (Object.prototype.hasOwnProperty.call(columns, key)) {
      const val = columns[key];
      if (val !== undefined) {
        result[key] = val;
      }
    }
  }
  return result;
}

function nonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "";
}

function tenantUserIdWhere(id: string, workspaceSubdomain: string) {
  return and(
    eq(tenantUsers.id, id),
    eq(tenantUsers.workspaceSubdomain, workspaceSubdomain.trim().toLowerCase()),
  );
}

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

/**
 * Soft-deletes a tenant user.
 *
 * `workspaceSubdomain` is the CALLER's tenant and is mandatory: the lookup and
 * the UPDATE are both scoped to it, so a caller can never address a user that
 * belongs to another workspace. (Previously the workspace was derived from the
 * fetched row, which — combined with an RLS-bypassing id-only lookup — allowed
 * cross-tenant deletes.)
 */
export async function softDeleteTenantUserRow(
  workspaceSubdomain: string,
  id: string,
  deletedBy: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  await revokeAllUserSessions(id);
  await revokeUserSessionKeys(id);
  await invalidateMultiTierCache({ tenantId: tenant, domain: "users", key: id });
  return true;
}

/** Restores a soft-deleted tenant user. Scoped to the CALLER's workspace. */
export async function restoreTenantUserRow(
  workspaceSubdomain: string,
  id: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || !existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "users", key: id });
  return true;
}

/** Marks a tenant user's email verified. Scoped to the CALLER's workspace. */
export async function verifyTenantUserEmailRow(
  workspaceSubdomain: string,
  id: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}

/**
 * Platform-admin variant of {@link verifyTenantUserEmailRow}: resolves the
 * target user's own workspace explicitly. Only call from platform routes.
 */
export async function verifyTenantUserEmailRowGlobal(id: string): Promise<boolean> {
  const existing = await findTenantUserRowByIdGlobal(id);
  if (!existing || existing.deletedAt) return false;
  const tenant =
    typeof existing.workspaceSubdomain === "string"
      ? existing.workspaceSubdomain.trim().toLowerCase()
      : "";
  if (!tenant) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}

/**
 * Replaces an active user's credential and requires a password change at next
 * sign-in. Scoped to the CALLER's workspace.
 */
export async function resetTenantUserPasswordRow(
  workspaceSubdomain: string,
  id: string,
  passwordHash: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}

/** Sets a self-chosen password from an accepted invite: verifies email, no forced re-change. */
export async function activateInvitedTenantUserRow(
  workspaceSubdomain: string,
  id: string,
  passwordHash: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        passwordHash,
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}
