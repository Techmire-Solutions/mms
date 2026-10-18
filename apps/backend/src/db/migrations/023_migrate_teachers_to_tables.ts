import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Faculty,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { bulkSaveFaculty } from "../repositories/facultyRepository.js";

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

export async function runMigration023(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const teachersKey = `${tenantCollectionKey(subdomain, "")}teachers`;
    const legacyTeachers = await getCollectionByStorageName(teachersKey);
    if (!Array.isArray(legacyTeachers) || legacyTeachers.length === 0) continue;

    const teachersList = legacyTeachers as unknown as Faculty[];
    await bulkSaveFaculty(subdomain, teachersList);
    changed = true;
    console.log(
      `[Migration 023] Imported ${teachersList.length} teacher(s) for "${subdomain}" into teachers table.`,
    );
  }

  if (!changed) {
    console.log("[Migration 023] No legacy teachers to import.");
  }
}
