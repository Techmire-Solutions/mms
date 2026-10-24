import {
  PLATFORM_SUPER_USERS_OBJECT_KEY,
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type StoredPlatformUser,
  type Workspace,
  type PlatformRole,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  getObjectByStorageKey,
  listCollectionStorageNames,
} from "../database.js";
import {
  countPlatformUserRows,
  insertPlatformUser,
} from "../repositories/platformUserRepository.js";
import {
  countTenantUsersByWorkspace,
  replaceTenantUsersForWorkspace,
  type TenantUserRow,
} from "../repositories/tenantUserRepository.js";

type LegacyUserRow = Record<string, unknown>;

async function discoverTenantSubdomains(): Promise<Set<string>> {
  const subdomains = new Set<string>();
  const names = await listCollectionStorageNames();
  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    if (parsed) subdomains.add(parsed.subdomain);
  }
  const workspaces = await getCollectionByStorageName(WORKSPACES_COLLECTION);
  if (Array.isArray(workspaces)) {
    for (const entry of workspaces) {
      const subdomain = (entry as Workspace).subdomain;
      if (subdomain) subdomains.add(subdomain);
    }
  }
  return subdomains;
}

function isAuthCapableUser(row: LegacyUserRow): boolean {
  return typeof row.passwordHash === "string" && row.passwordHash.length > 0;
}

/**
 * One-time migration: legacy JSON platform/tenant users → dedicated relational tables.
 */
export async function runMigration012(): Promise<void> {
  let changed = false;

  if ((await countPlatformUserRows()) === 0) {
    const raw = await getObjectByStorageKey(PLATFORM_SUPER_USERS_OBJECT_KEY);
    if (Array.isArray(raw) && raw.length > 0) {
      for (const entry of raw) {
        const user = entry as StoredPlatformUser;
        if (!user?.id || !user.email || !user.passwordHash) continue;
        await insertPlatformUser({
          id: user.id,
          email: user.email.toLowerCase(),
          name: user.name ?? "Platform Admin",
          passwordHash: user.passwordHash,
          role: (user.role ?? "super_user") as PlatformRole,
          permissions: user.permissions ?? { workspaces: true, onboard: true },
          sessionVersion: user.sessionVersion ?? 0,
          createdAt: user.createdAt ?? new Date().toISOString(),
          emailVerifiedAt: user.emailVerifiedAt,
        });
      }
      changed = true;
      console.log("[Migration 012] Imported platform users into platform_users table.");
    }
  }

  const subdomains = await discoverTenantSubdomains();
  for (const subdomain of subdomains) {
    if ((await countTenantUsersByWorkspace(subdomain)) > 0) continue;

    const usersKey = `${tenantCollectionKey(subdomain, "")}users`;
    const users = await getCollectionByStorageName(usersKey);
    if (!Array.isArray(users) || users.length === 0) continue;

    const authUsers = users.filter((row) => isAuthCapableUser(row as LegacyUserRow));
    if (authUsers.length === 0) continue;

    const normalized = authUsers.map((row) => ({
      ...(row as LegacyUserRow),
      workspaceSubdomain: subdomain,
    })) as TenantUserRow[];

    await replaceTenantUsersForWorkspace(subdomain, normalized);
    changed = true;
    console.log(
      `[Migration 012] Imported ${normalized.length} tenant user(s) for "${subdomain}" into tenant_users table.`,
    );
  }

  if (!changed) {
    console.log("[Migration 012] User tables already populated — no legacy import needed.");
  }
}
