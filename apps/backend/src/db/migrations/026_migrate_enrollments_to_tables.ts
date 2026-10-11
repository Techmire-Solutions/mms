import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Enrollment,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { bulkSaveEnrollments } from "../repositories/enrollmentRepository.js";

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

export async function runMigration026(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const enrollmentsKey = `${tenantCollectionKey(subdomain, "")}enrollments`;
    const legacyEnrollments = await getCollectionByStorageName(enrollmentsKey);
    if (!Array.isArray(legacyEnrollments) || legacyEnrollments.length === 0) continue;

    const enrollmentsList = legacyEnrollments as Enrollment[];
    await bulkSaveEnrollments(subdomain, enrollmentsList);
    changed = true;
    console.log(
      `[Migration 026] Imported ${enrollmentsList.length} enrollment record(s) for "${subdomain}" into enrollments table.`,
    );
  }

  if (!changed) {
    console.log("[Migration 026] No legacy enrollment records to import.");
  }
}
