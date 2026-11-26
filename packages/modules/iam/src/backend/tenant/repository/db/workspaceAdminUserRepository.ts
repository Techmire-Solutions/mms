import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { isAdminRole, isSuperAdminRole } from "@mms/contracts";
import { randomBytes } from "node:crypto";
import { tenantUsers } from "@mms/db/schema";
import { withGlobalTenant } from "@mms/db/context";
import { hashPassword } from "../../deps.js";
import { getWorkspaceWithBranding } from "../../deps.js";
import { normalizeSubdomainInput } from "../../deps.js";

/**
 * Platform-admin access to `tenant_users` across workspaces.
 *
 * Every query here is a platform/apex operation rather than a tenant one, so it
 * runs inside an explicit `withGlobalTenant` scope. Two reasons: `tenant_users`
 * is FORCE ROW LEVEL SECURITY, so statements without the `app.rls_bypass` /
 * `app.current_tenant` GUCs see no rows at all (which silently disabled the
 * duplicate-email pre-checks); and reading through the root pool (`getDb()`)
 * escaped an ambient transaction instead of joining it.
 */

/**
 * Primary-admin ordering for platform flows: the tenant apex admin first, then
 * standard admins, then everyone else; ties keep the earliest-created account.
 */
function adminPriority(role: string | undefined | null): number {
  if (isSuperAdminRole(role ?? undefined)) return 0;
  if (isAdminRole(role ?? undefined)) return 1;
  return 2;
}

/** Cryptographically random temporary password for platform break-glass flows. */
export function generateTemporaryAdminPassword(): string {
  return `Mms#${randomBytes(6).toString("base64url")}`;
}

export function generateTenantUserId(): string {
  return `usr_${randomBytes(8).toString("hex")}`;
}

/** Fetch map of primary admin emails by workspace subdomain. */
export async function getWorkspaceAdminEmailsMap(
  subdomains: string[],
): Promise<Map<string, string>> {
  if (subdomains.length === 0) return new Map();
  const cleanSubdomains = subdomains.map((s) => s.toLowerCase());

  return withGlobalTenant(async (db) => {
    const rows = await db
      .select({
        subdomain: tenantUsers.workspaceSubdomain,
        email: tenantUsers.loginEmail,
        role: tenantUsers.role,
        createdAt: tenantUsers.createdAt,
      })
      .from(tenantUsers)
      .where(
        and(
          inArray(tenantUsers.workspaceSubdomain, cleanSubdomains),
          isNull(tenantUsers.deletedAt),
        ),
      );

    rows.sort(
      (
        a: { role?: string; createdAt?: Date | null },
        b: { role?: string; createdAt?: Date | null },
      ) => {
        const byPriority = adminPriority(a.role) - adminPriority(b.role);
        if (byPriority !== 0) return byPriority;
        return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
      },
    );

    const map = new Map<string, string>();
    for (const row of rows) {
      const key = row.subdomain.toLowerCase();
      if (!map.has(key)) {
        map.set(key, row.email);
      }
    }
    return map;
  });
}

/** Reset admin password for a tenant workspace. */
export async function resetWorkspaceAdminPassword(
  subdomain: string,
  newPasswordInput?: string,
): Promise<{ success: true; subdomain: string; adminEmail: string; newPassword: string } | null> {
  const normalized = normalizeSubdomainInput(subdomain);
  const data = await getWorkspaceWithBranding(normalized);
  if (!data) return null;

  return withGlobalTenant(async (db) => {
    const users = await db
      .select({
        id: tenantUsers.id,
        role: tenantUsers.role,
        loginEmail: tenantUsers.loginEmail,
        createdAt: tenantUsers.createdAt,
      })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.workspaceSubdomain, normalized), isNull(tenantUsers.deletedAt)));

    users.sort(
      (
        a: { role?: string; createdAt?: Date | null },
        b: { role?: string; createdAt?: Date | null },
      ) => {
        const byPriority = adminPriority(a.role) - adminPriority(b.role);
        if (byPriority !== 0) return byPriority;
        return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
      },
    );

    const targetUser = users[0];
    const fallbackEmail = data.branding?.email?.trim() || `admin@${normalized}.local`;

    const newPassword = newPasswordInput?.trim() || generateTemporaryAdminPassword();
    const passwordHash = await hashPassword(newPassword);

    if (!targetUser) {
      const userId = generateTenantUserId();
      await db.insert(tenantUsers).values({
        id: userId,
        workspaceSubdomain: normalized,
        loginEmail: fallbackEmail,
        passwordHash,
        name: "Admin",
        // The recovery admin is the workspace's first user, so it takes the apex role.
        role: "super_admin",
        // Platform-vouched address: satisfies the workspace email-verification policy.
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return {
        success: true,
        subdomain: normalized,
        adminEmail: fallbackEmail,
        newPassword,
      };
    }

    await db
      .update(tenantUsers)
      .set({
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(tenantUsers.id, targetUser.id));

    return {
      success: true,
      subdomain: normalized,
      adminEmail: targetUser.loginEmail,
      newPassword,
    };
  });
}

/** Create a new admin user for a tenant workspace from platform console. */
export async function createWorkspaceAdminUser(
  subdomain: string,
  input: { name: string; email: string; password?: string },
): Promise<
  | { success: true; subdomain: string; adminEmail: string; name: string; initialPassword: string }
  | { success: false; error: "WORKSPACE_NOT_FOUND" | "USER_ALREADY_EXISTS" }
> {
  const normalized = normalizeSubdomainInput(subdomain);
  const data = await getWorkspaceWithBranding(normalized);
  if (!data) return { success: false, error: "WORKSPACE_NOT_FOUND" };

  const emailClean = input.email.trim().toLowerCase();

  return withGlobalTenant(async (db) => {
    // Serialize the first-admin decision per workspace: two concurrent "create admin"
    // calls could otherwise both observe zero super_admins and mint two apex identities.
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${normalized}), hashtext('workspace-admin-role'))`,
    );

    const activeUsers = await db
      .select({
        id: tenantUsers.id,
        loginEmail: tenantUsers.loginEmail,
        role: tenantUsers.role,
        deletedAt: tenantUsers.deletedAt,
      })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.workspaceSubdomain, normalized), isNull(tenantUsers.deletedAt)));

    // The SQL predicate already excludes trashed rows; keep the in-memory guard so a
    // relaxed predicate can never bring a deleted account back into either decision.
    const liveUsers = activeUsers.filter((row) => !row.deletedAt);

    const existing = liveUsers.find((row) => row.loginEmail.trim().toLowerCase() === emailClean);
    if (existing) {
      return { success: false, error: "USER_ALREADY_EXISTS" } as const;
    }

    // A tenant's first admin is its ONLY super_admin; admins created later from the
    // platform console stay plain `admin` so the apex tenant identity stays singular.
    const role = liveUsers.some((row) => row.role === "super_admin") ? "admin" : "super_admin";

    const initialPassword = input.password?.trim() || generateTemporaryAdminPassword();
    const passwordHash = await hashPassword(initialPassword);

    const userId = generateTenantUserId();
    await db.insert(tenantUsers).values({
      id: userId,
      workspaceSubdomain: normalized,
      loginEmail: emailClean,
      passwordHash,
      name: input.name.trim(),
      role,
      // Platform-vouched address: the operator hands the credentials over directly.
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      subdomain: normalized,
      adminEmail: emailClean,
      name: input.name.trim(),
      initialPassword,
    } as const;
  });
}

/**
 * Active `super_admin` user ids for a workspace.
 *
 * Workspace provisioning uses this to verify the invariant that the freshly created
 * admin is the tenant's one and only super admin (no platform user is mirrored in).
 */
export async function listWorkspaceSuperAdminIds(subdomain: string): Promise<string[]> {
  const normalized = normalizeSubdomainInput(subdomain);
  return withGlobalTenant(async (db) => {
    const rows = await db
      .select({
        id: tenantUsers.id,
        role: tenantUsers.role,
        deletedAt: tenantUsers.deletedAt,
      })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.workspaceSubdomain, normalized), isNull(tenantUsers.deletedAt)));
    return rows
      .filter((row) => !row.deletedAt && row.role === "super_admin")
      .map((row) => String(row.id));
  });
}
