import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type ActivityLog,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { replaceActivityLogsForWorkspace } from "../repositories/logsRepository.js";

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

export async function runMigration033(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");

    // 1. User Activity Logs
    const legacyActivityLogs = await getCollectionByStorageName(`${prefix}user_activity_logs`);
    if (Array.isArray(legacyActivityLogs) && legacyActivityLogs.length > 0) {
      await replaceActivityLogsForWorkspace(subdomain, legacyActivityLogs as ActivityLog[]);
      changed = true;
      console.log(
        `[Migration 033] Imported ${legacyActivityLogs.length} activity log(s) for "${subdomain}" into user_activity_logs table.`,
      );
    }
  }

  if (!changed) {
    console.log("[Migration 033] No legacy activity logs to import.");
  }
}
