import {
  hydrateWorkspaceUserProfile,
  resolveTenantLoginEmail,
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type ContactLike,
  type Workspace,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  listCollectionStorageNames,
  saveCollection,
} from "../database.js";

type Row = Record<string, unknown>;

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

function backfillUserAuthFields(user: Row, contacts: ContactLike[]): Row {
  const hydrated = hydrateWorkspaceUserProfile(user, contacts) as Row;
  const hasPassword = typeof user.passwordHash === "string" && user.passwordHash.length > 0;
  if (!hasPassword) return user;

  const loginEmail = resolveTenantLoginEmail(
    user as Row & { loginEmail?: string; email?: string },
    typeof hydrated.email === "string" ? hydrated.email : undefined,
  );
  if (!loginEmail) return user;

  const next: Row = { ...user, loginEmail };
  if (!next.emailVerifiedAt) {
    next.emailVerifiedAt =
      typeof user.createdAt === "string" ? user.createdAt : new Date().toISOString();
  }
  return next;
}

/**
 * Backfills `loginEmail` and `emailVerifiedAt` on auth-capable workspace users.
 */
export async function runMigration008(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  let changed = false;

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");
    const usersKey = `${prefix}users`;
    const contactsKey = `${prefix}contacts`;
    const users = await getCollectionByStorageName(usersKey);
    if (!Array.isArray(users) || users.length === 0) continue;

    const contactsRaw = await getCollectionByStorageName(contactsKey);
    const contacts = Array.isArray(contactsRaw) ? (contactsRaw as ContactLike[]) : [];

    const next = users.map((row) => backfillUserAuthFields(row as Row, contacts));
    if (JSON.stringify(next) !== JSON.stringify(users)) {
      await saveCollection(usersKey, next);
      changed = true;
    }
  }

  if (changed) {
    console.log("[Migration 008] Backfilled loginEmail and emailVerifiedAt on auth users.");
  }
}
