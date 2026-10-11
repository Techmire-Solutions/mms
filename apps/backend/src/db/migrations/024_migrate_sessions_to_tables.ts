import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { bulkSaveSessions } from "../repositories/sessionRepository.js";
import type { SessionRecord } from "@mms/shared";

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

export async function runMigration024(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const sessionsKey = `${tenantCollectionKey(subdomain, "")}sessions`;
    const legacySessions = await getCollectionByStorageName(sessionsKey);
    if (!Array.isArray(legacySessions) || legacySessions.length === 0) continue;

    const sessionsList = legacySessions as SessionRecord[];
    await bulkSaveSessions(subdomain, sessionsList);
    changed = true;
    console.log(
      `[Migration 024] Imported ${sessionsList.length} session(s) for "${subdomain}" into sessions table.`,
    );
  }

  if (!changed) {
    console.log("[Migration 024] No legacy sessions to import.");
  }
}
