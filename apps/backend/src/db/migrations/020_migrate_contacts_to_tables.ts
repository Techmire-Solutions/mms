import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Contact,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { bulkSaveContacts } from "../repositories/contactRepository.js";

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

export async function runMigration020(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const contactsKey = `${tenantCollectionKey(subdomain, "")}contacts`;
    const legacyContacts = await getCollectionByStorageName(contactsKey);
    if (!Array.isArray(legacyContacts) || legacyContacts.length === 0) continue;

    const contactsList = legacyContacts as Contact[];
    await bulkSaveContacts(subdomain, contactsList);
    changed = true;
    console.log(
      `[Migration 020] Imported ${contactsList.length} contact(s) for "${subdomain}" into contacts table.`,
    );
  }

  if (!changed) {
    console.log("[Migration 020] No legacy contacts to import.");
  }
}
