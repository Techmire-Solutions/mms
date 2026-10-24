import {
  normalizeStoredFaculty,
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  listCollectionStorageNames,
  saveCollection,
} from "../database.js";
const LEGACY_SEEDED_FACULTY_ID = /^tch([1-9]|[12]\d|30)$/;
/** Historical document-store collection key (pre-faculty rename). */
const LEGACY_COLLECTION_KEY = "teachers";

interface LegacyFacultyRow {
  id: string | number;
  contactId?: string | number | null;
  name?: string;
  phone?: string;
  email?: string;
  gender?: string;
  [key: string]: unknown;
}

interface ContactRow {
  id: string | number;
  name?: string;
}

function resolveContactId(
  faculty: LegacyFacultyRow,
  contacts: ContactRow[],
): string | number | null {
  if (faculty.contactId != null && faculty.contactId !== "") {
    return faculty.contactId;
  }
  const seededId = String(faculty.id).match(LEGACY_SEEDED_FACULTY_ID);
  if (seededId) return Number(seededId[1]);
  if (faculty.name) {
    const match = contacts.find((contact) => contact.name === faculty.name);
    if (match) return match.id;
  }
  return null;
}

function normalizeTenantFaculty(
  facultyRows: LegacyFacultyRow[],
  contacts: ContactRow[],
): { next: LegacyFacultyRow[]; changed: boolean } {
  let changed = false;
  const next = facultyRows.map((faculty) => {
    const contactId = resolveContactId(faculty, contacts);
    const withContact = contactId != null ? { ...faculty, contactId } : faculty;
    const normalized = normalizeStoredFaculty(withContact) as LegacyFacultyRow;
    if (JSON.stringify(normalized) !== JSON.stringify(faculty)) {
      changed = true;
    }
    return normalized;
  });
  return { next, changed };
}

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

/**
 * Links legacy faculty rows to contacts and strips duplicated contact fields.
 */
export async function runMigration005(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  let changed = false;

  const normalizeStorage = async (facultyKey: string, contactsKey: string) => {
    const facultyRows = await getCollectionByStorageName(facultyKey);
    if (!Array.isArray(facultyRows) || facultyRows.length === 0) return;

    const contacts = (await getCollectionByStorageName(contactsKey)) as ContactRow[] | null;
    const { next, changed: rowChanged } = normalizeTenantFaculty(
      facultyRows as LegacyFacultyRow[],
      Array.isArray(contacts) ? contacts : [],
    );
    if (!rowChanged) return;

    await saveCollection(facultyKey, next);
    changed = true;
  };

  const targetCollectionKeys = ["faculty", LEGACY_COLLECTION_KEY];

  if (subdomains.size === 0) {
    for (const key of targetCollectionKeys) {
      await normalizeStorage(key, "contacts");
    }
  } else {
    for (const subdomain of subdomains) {
      for (const key of targetCollectionKeys) {
        await normalizeStorage(
          tenantCollectionKey(subdomain, key),
          tenantCollectionKey(subdomain, "contacts"),
        );
      }
    }
  }

  if (changed) {
    console.log("[Migration 005] Linked faculty to contacts and removed duplicate profile fields.");
  }
}
