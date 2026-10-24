import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Student,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { bulkSaveStudents } from "../repositories/studentRepository.js";

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

export async function runMigration022(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const studentsKey = `${tenantCollectionKey(subdomain, "")}students`;
    const legacyStudents = await getCollectionByStorageName(studentsKey);
    if (!Array.isArray(legacyStudents) || legacyStudents.length === 0) continue;

    const studentsList = legacyStudents as Student[];
    await bulkSaveStudents(subdomain, studentsList);
    changed = true;
    console.log(
      `[Migration 022] Imported ${studentsList.length} student(s) for "${subdomain}" into students table.`,
    );
  }

  if (!changed) {
    console.log("[Migration 022] No legacy students to import.");
  }
}
