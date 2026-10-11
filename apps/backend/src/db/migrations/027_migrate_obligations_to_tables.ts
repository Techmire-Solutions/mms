import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type ObligationType,
  type Mujtahid,
  type MujtahidRep,
  type WakalaType,
  type ObligationDistribution,
  type ObligationCollection,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import {
  replaceObligationTypesForWorkspace,
  replaceMujtahidsForWorkspace,
  replaceMujtahidRepsForWorkspace,
  replaceWakalaTypesForWorkspace,
  replaceObligationDistributionsForWorkspace,
  replaceObligationCollectionsForWorkspace,
} from "../repositories/obligationRepository.js";

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

export async function runMigration027(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");

    // 1. Obligation Types
    const legacyTypes = await getCollectionByStorageName(`${prefix}obligation_types`);
    if (Array.isArray(legacyTypes) && legacyTypes.length > 0) {
      await replaceObligationTypesForWorkspace(subdomain, legacyTypes as ObligationType[]);
      changed = true;
    }

    // 2. Mujtahids
    const legacyMujtahids = await getCollectionByStorageName(`${prefix}mujtahids`);
    if (Array.isArray(legacyMujtahids) && legacyMujtahids.length > 0) {
      await replaceMujtahidsForWorkspace(subdomain, legacyMujtahids as Mujtahid[]);
      changed = true;
    }

    // 3. Mujtahid Reps
    const legacyReps = await getCollectionByStorageName(`${prefix}mujtahid_reps`);
    if (Array.isArray(legacyReps) && legacyReps.length > 0) {
      await replaceMujtahidRepsForWorkspace(subdomain, legacyReps as MujtahidRep[]);
      changed = true;
    }

    // 4. Wakala Types
    const legacyWakala = await getCollectionByStorageName(`${prefix}wakala_types`);
    if (Array.isArray(legacyWakala) && legacyWakala.length > 0) {
      await replaceWakalaTypesForWorkspace(subdomain, legacyWakala as WakalaType[]);
      changed = true;
    }

    // 5. Obligation Distributions
    const legacyDist = await getCollectionByStorageName(`${prefix}obligation_distributions`);
    if (Array.isArray(legacyDist) && legacyDist.length > 0) {
      await replaceObligationDistributionsForWorkspace(
        subdomain,
        legacyDist as ObligationDistribution[],
      );
      changed = true;
    }

    // 6. Obligation Collections
    const legacyColl = await getCollectionByStorageName(`${prefix}obligation_collections`);
    if (Array.isArray(legacyColl) && legacyColl.length > 0) {
      await replaceObligationCollectionsForWorkspace(
        subdomain,
        legacyColl as ObligationCollection[],
      );
      changed = true;
    }
  }

  if (changed) {
    console.log(
      "[Migration 027] Imported legacy obligations collections into new dedicated relational tables.",
    );
  } else {
    console.log("[Migration 027] No legacy obligations records to import.");
  }
}
