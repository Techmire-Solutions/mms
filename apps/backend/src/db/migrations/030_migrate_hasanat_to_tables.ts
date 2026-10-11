import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Denomination,
  type StockBatch,
  type Distribution,
  type Redemption,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import {
  replaceDenomsForWorkspace,
  replaceBatchesForWorkspace,
  replaceDistributionsForWorkspace,
  replaceRedemptionsForWorkspace,
} from "../repositories/hasanatRepository.js";

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

export async function runMigration030(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");

    // 1. Denominations
    const legacyDenoms = await getCollectionByStorageName(`${prefix}hasanat_denoms`);
    if (Array.isArray(legacyDenoms) && legacyDenoms.length > 0) {
      await replaceDenomsForWorkspace(subdomain, legacyDenoms as Denomination[]);
      changed = true;
      console.log(
        `[Migration 030] Imported ${legacyDenoms.length} denomination(s) for "${subdomain}" into hasanat_denoms table.`,
      );
    }

    // 2. Batches
    const legacyBatches = await getCollectionByStorageName(`${prefix}hasanat_batches`);
    if (Array.isArray(legacyBatches) && legacyBatches.length > 0) {
      await replaceBatchesForWorkspace(subdomain, legacyBatches as StockBatch[]);
      changed = true;
      console.log(
        `[Migration 030] Imported ${legacyBatches.length} batch(es) for "${subdomain}" into hasanat_batches table.`,
      );
    }

    // 3. Distributions
    const legacyDists = await getCollectionByStorageName(`${prefix}hasanat_distributions`);
    if (Array.isArray(legacyDists) && legacyDists.length > 0) {
      await replaceDistributionsForWorkspace(subdomain, legacyDists as Distribution[]);
      changed = true;
      console.log(
        `[Migration 030] Imported ${legacyDists.length} distribution(s) for "${subdomain}" into hasanat_distributions table.`,
      );
    }

    // 4. Redemptions
    const legacyRedemptions = await getCollectionByStorageName(`${prefix}hasanat_redemptions`);
    if (Array.isArray(legacyRedemptions) && legacyRedemptions.length > 0) {
      await replaceRedemptionsForWorkspace(subdomain, legacyRedemptions as Redemption[]);
      changed = true;
      console.log(
        `[Migration 030] Imported ${legacyRedemptions.length} redemption(s) for "${subdomain}" into hasanat_redemptions table.`,
      );
    }
  }

  if (!changed) {
    console.log("[Migration 030] No legacy hasanat records to import.");
  }
}
