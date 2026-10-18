import {
  DEFAULT_STUDENTS_SETTINGS,
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

const STUDENTS_COLLECTION = "students";
const CONTACTS_COLLECTION = "contacts";
const STUDENTS_SETTINGS_KEY = "students_settings";

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

async function seedTenantStudents(
  studentsKey: string,
  contactsKey: string,
  settingsKey: string,
): Promise<boolean> {
  let changed = false;
  const existingStudents = await getCollectionByStorageName(studentsKey);
  if (!Array.isArray(existingStudents) || existingStudents.length === 0) {
    await saveCollection(studentsKey, []);
    changed = true;
  }

  const existingContacts = await getCollectionByStorageName(contactsKey);
  if (!Array.isArray(existingContacts)) {
    await saveCollection(contactsKey, []);
    changed = true;
  }

  const settings = await getObjectByStorageKey(settingsKey);
  if (settings === null) {
    await saveObject(settingsKey, DEFAULT_STUDENTS_SETTINGS);
    changed = true;
  }

  return changed;
}

/**
 * Initializes student/contact storage and default settings without creating student records.
 * Idempotent - skips storage that is already initialized.
 */
export async function runMigration009(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  let changed = false;

  if (subdomains.size === 0) {
    if (await seedTenantStudents(STUDENTS_COLLECTION, CONTACTS_COLLECTION, STUDENTS_SETTINGS_KEY)) {
      console.log("[Migration 009] Initialized student storage (legacy storage)");
      changed = true;
    }
  } else {
    for (const subdomain of subdomains) {
      if (
        await seedTenantStudents(
          tenantCollectionKey(subdomain, STUDENTS_COLLECTION),
          tenantCollectionKey(subdomain, CONTACTS_COLLECTION),
          tenantObjectKey(subdomain, STUDENTS_SETTINGS_KEY),
        )
      ) {
        console.log(`[Migration 009] Initialized student storage for tenant "${subdomain}"`);
        changed = true;
      }
    }
  }

  if (changed) {
    console.log("[Migration 009] Student storage migration completed.");
  }
}
