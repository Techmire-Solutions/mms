import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Invoice,
  type Payment,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import {
  replaceInvoicesForWorkspace,
  replacePaymentsForWorkspace,
} from "../repositories/financeRepository.js";

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

export async function runMigration028(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");

    // 1. Finance Invoices
    const legacyInvoices = await getCollectionByStorageName(`${prefix}finance_invoices`);
    if (Array.isArray(legacyInvoices) && legacyInvoices.length > 0) {
      await replaceInvoicesForWorkspace(subdomain, legacyInvoices as Invoice[]);
      changed = true;
      console.log(
        `[Migration 028] Imported ${legacyInvoices.length} invoice(s) for "${subdomain}" into finance_invoices table.`,
      );
    }

    // 2. Finance Payments
    const legacyPayments = await getCollectionByStorageName(`${prefix}finance_payments`);
    if (Array.isArray(legacyPayments) && legacyPayments.length > 0) {
      await replacePaymentsForWorkspace(subdomain, legacyPayments as Payment[]);
      changed = true;
      console.log(
        `[Migration 028] Imported ${legacyPayments.length} payment(s) for "${subdomain}" into finance_payments table.`,
      );
    }
  }

  if (!changed) {
    console.log("[Migration 028] No legacy finance records to import.");
  }
}
