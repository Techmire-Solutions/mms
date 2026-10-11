import {
  DEFAULT_FACULTY_SETTINGS,
  WORKSPACES_COLLECTION,
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  tenantObjectKey,
  type Workspace,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  getObjectByStorageKey,
  listCollectionStorageNames,
  saveCollection,
  saveObject,
} from "../database.js";

const TEACHERS_COLLECTION = "teachers";
const CONTACTS_COLLECTION = "contacts";
const TEACHERS_SETTINGS_KEY = "teachers_settings";

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

async function seedTenantTeachers(
  teachersKey: string,
  contactsKey: string,
  settingsKey: string,
): Promise<boolean> {
  let changed = false;
  const existingTeachers = await getCollectionByStorageName(teachersKey);
  if (!Array.isArray(existingTeachers) || existingTeachers.length === 0) {
    await saveCollection(teachersKey, []);
    changed = true;
  }

  const existingContacts = await getCollectionByStorageName(contactsKey);
  if (!Array.isArray(existingContacts)) {
    await saveCollection(contactsKey, []);
    changed = true;
  }

  const settings = await getObjectByStorageKey(settingsKey);
  if (settings === null) {
    await saveObject(settingsKey, DEFAULT_FACULTY_SETTINGS);
    changed = true;
  }

  return changed;
}

/**
 * Initializes teacher/contact storage and default settings without creating records.
 * Idempotent - skips storage that is already initialized.
 */
export async function runMigration010(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  let changed = false;

  if (subdomains.size === 0) {
    if (await seedTenantTeachers(TEACHERS_COLLECTION, CONTACTS_COLLECTION, TEACHERS_SETTINGS_KEY)) {
      console.log("[Migration 010] Initialized teacher/contact storage (legacy storage)");
      changed = true;
    }
  } else {
    for (const subdomain of subdomains) {
      if (
        await seedTenantTeachers(
          tenantCollectionKey(subdomain, TEACHERS_COLLECTION),
          tenantCollectionKey(subdomain, CONTACTS_COLLECTION),
          tenantObjectKey(subdomain, TEACHERS_SETTINGS_KEY),
        )
      ) {
        console.log(
          `[Migration 010] Initialized teacher/contact storage for tenant "${subdomain}"`,
        );
        changed = true;
      }
    }
  }

  if (changed) {
    console.log("[Migration 010] Teacher/contact storage migration completed.");
  }
}
