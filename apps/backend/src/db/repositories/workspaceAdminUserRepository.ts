import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { tenantUsers } from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { hashPassword } from "../../services/auth/passwordService.js";
import { getWorkspaceWithBranding } from "./workspaceRepository.js";
import { normalizeSubdomainInput } from "../../services/workspaceService.js";

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
        const aIsAdmin = a.role === "admin" || a.role === "super_user" ? 0 : 1;
        const bIsAdmin = b.role === "admin" || b.role === "super_user" ? 0 : 1;
        if (aIsAdmin !== bIsAdmin) return aIsAdmin - bIsAdmin;
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
        const aIsAdmin = a.role === "admin" || a.role === "super_user" ? 0 : 1;
        const bIsAdmin = b.role === "admin" || b.role === "super_user" ? 0 : 1;
        if (aIsAdmin !== bIsAdmin) return aIsAdmin - bIsAdmin;
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
        role: "admin",
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
    const existing = await db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.workspaceSubdomain, normalized),
          eq(tenantUsers.loginEmail, emailClean),
          isNull(tenantUsers.deletedAt),
        ),
      );

    if (existing.length > 0) {
      return { success: false, error: "USER_ALREADY_EXISTS" } as const;
    }

    const initialPassword = input.password?.trim() || generateTemporaryAdminPassword();
    const passwordHash = await hashPassword(initialPassword);

    const userId = generateTenantUserId();
    await db.insert(tenantUsers).values({
      id: userId,
      workspaceSubdomain: normalized,
      loginEmail: emailClean,
      passwordHash,
      name: input.name.trim(),
      role: "admin",
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
