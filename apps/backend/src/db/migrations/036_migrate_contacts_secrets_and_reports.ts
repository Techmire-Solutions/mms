import {
  CONTACT_GOOGLE_SYNC_BY_USER_OBJECT_KEY,
  CONTACTS_SAVED_REPORT_CATEGORY,
  parseTenantScopedStorageKey,
  tenantObjectKey,
  WORKSPACES_COLLECTION,
  type ContactsSavedReport,
  type Workspace,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  getObjectByStorageKey,
  listObjectStorageKeys,
  deleteObjectByStorageKey,
} from "../database.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { replaceContactGoogleSyncCredentialsForWorkspace } from "../repositories/contactGoogleSyncRepository.js";
import {
  createPersistedSavedReport,
  findSavedReportById,
  listSavedReportsByCategory,
} from "../repositories/savedReportsRepository.js";

/** Legacy objects key — migrated to typed `saved_reports` (category `contacts`). */
const LEGACY_CONTACTS_SAVED_REPORTS_OBJECT_KEY = "contacts_saved_reports";

async function discoverTenantSubdomains(): Promise<Set<string>> {
  const subdomains = new Set<string>();
  const keys = await listObjectStorageKeys();
  for (const key of keys) {
    const parsed = parseTenantScopedStorageKey(key);
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

async function migrateGoogleSyncForTenant(subdomain: string): Promise<void> {
  const storageKey = tenantObjectKey(subdomain, CONTACT_GOOGLE_SYNC_BY_USER_OBJECT_KEY);
  const raw = await getObjectByStorageKey(storageKey);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;

  const entries = Object.entries(raw as Record<string, Record<string, unknown>>)
    .filter(([userId]) => Boolean(userId))
    .map(([userId, config]) => ({
      userId,
      clientId: typeof config.clientId === "string" ? config.clientId : undefined,
      clientSecret: typeof config.clientSecret === "string" ? config.clientSecret : undefined,
      accessToken: typeof config.accessToken === "string" ? config.accessToken : undefined,
      refreshToken: typeof config.refreshToken === "string" ? config.refreshToken : undefined,
      updatedAt: typeof config.updatedAt === "string" ? config.updatedAt : undefined,
    }));

  await runWithTenant(subdomain, async () => {
    await replaceContactGoogleSyncCredentialsForWorkspace(subdomain, entries);
  });
  await deleteObjectByStorageKey(storageKey);
}

async function migrateContactsSavedReportsForTenant(subdomain: string): Promise<void> {
  const storageKey = tenantObjectKey(subdomain, LEGACY_CONTACTS_SAVED_REPORTS_OBJECT_KEY);
  const raw = await getObjectByStorageKey(storageKey);
  if (!Array.isArray(raw) || raw.length === 0) return;

  await runWithTenant(subdomain, async () => {
    const already = await listSavedReportsByCategory(subdomain, CONTACTS_SAVED_REPORT_CATEGORY);
    const existingIds = new Set(already.map((row) => row.id));

    for (const entry of raw as ContactsSavedReport[]) {
      if (!entry?.id || !entry.name || !entry.createdBy) continue;
      if (existingIds.has(entry.id)) continue;
      const found = await findSavedReportById(subdomain, entry.id, CONTACTS_SAVED_REPORT_CATEGORY);
      if (found) continue;

      const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
      const lastRunAt = entry.lastRunAt ? new Date(entry.lastRunAt) : createdAt;
      await createPersistedSavedReport(subdomain, {
        id: entry.id,
        name: entry.name,
        category: CONTACTS_SAVED_REPORT_CATEGORY,
        filters: {
          drillDown: entry.drillDown ?? {},
          shareScope: entry.shareScope ?? "private",
          sharedWithRoles: entry.sharedWithRoles ?? [],
          sharedWithUserIds: entry.sharedWithUserIds ?? [],
        },
        createdBy: entry.createdBy,
        createdByName: entry.createdByName ?? "",
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        lastRunAt: Number.isNaN(lastRunAt.getTime()) ? new Date() : lastRunAt,
      });
    }
  });

  await deleteObjectByStorageKey(storageKey);
}

/**
 * Move Contacts Google OAuth secrets and saved reports out of the unscoped objects store
 * into FORCE-RLS tenant tables.
 */
export async function runMigration036(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  for (const subdomain of subdomains) {
    await migrateGoogleSyncForTenant(subdomain);
    await migrateContactsSavedReportsForTenant(subdomain);
  }
}
