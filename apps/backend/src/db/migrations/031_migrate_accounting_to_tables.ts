import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Account,
  type JournalEntry,
  type FiscalYear,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import {
  replaceAccountsForWorkspace,
  replaceEntriesForWorkspace,
  replaceFiscalYearsForWorkspace,
} from "../repositories/accountingRepository.js";

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

export async function runMigration031(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");

    // 1. Accounts
    const legacyAccounts = await getCollectionByStorageName(`${prefix}accounting_accounts`);
    if (Array.isArray(legacyAccounts) && legacyAccounts.length > 0) {
      await replaceAccountsForWorkspace(subdomain, legacyAccounts as Account[]);
      changed = true;
      console.log(
        `[Migration 031] Imported ${legacyAccounts.length} account(s) for "${subdomain}" into accounting_accounts table.`,
      );
    }

    // 2. Journal Entries
    const legacyEntries = await getCollectionByStorageName(`${prefix}accounting_entries`);
    if (Array.isArray(legacyEntries) && legacyEntries.length > 0) {
      await replaceEntriesForWorkspace(subdomain, legacyEntries as JournalEntry[]);
      changed = true;
      console.log(
        `[Migration 031] Imported ${legacyEntries.length} journal entry/entries for "${subdomain}" into accounting_entries table.`,
      );
    }

    // 3. Fiscal Years
    const legacyFiscalYears = await getCollectionByStorageName(`${prefix}accounting_fiscal_years`);
    if (Array.isArray(legacyFiscalYears) && legacyFiscalYears.length > 0) {
      await replaceFiscalYearsForWorkspace(subdomain, legacyFiscalYears as FiscalYear[]);
      changed = true;
      console.log(
        `[Migration 031] Imported ${legacyFiscalYears.length} fiscal year(s) for "${subdomain}" into accounting_fiscal_years table.`,
      );
    }
  }

  if (!changed) {
    console.log("[Migration 031] No legacy accounting records to import.");
  }
}
