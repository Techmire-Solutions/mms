/**
 * Deletes orphan document-store Question Bank Setup keys after typed-table backfill (072).
 * Safe to re-run: skips delete when typed Setup rows are missing for that tenant.
 */
import { eq } from "drizzle-orm";
import { parseTenantScopedStorageKey, QUESTION_BANK_MODULE_MANIFEST } from "@mms/shared";
import * as schema from "../schema.js";
import { deleteObjectByStorageKey, listObjectStorageKeys } from "../database.js";
import { withGlobalTenant, type TenantTransaction } from "../tenant-context.js";

const SETTINGS_KEY = QUESTION_BANK_MODULE_MANIFEST.settingsObjectKey;

type Tx = TenantTransaction;

async function tenantHasTypedSetup(tx: Tx, tenant: string): Promise<boolean> {
  const [field] = await tx
    .select({ workspaceSubdomain: schema.questionBankFieldConfigs.workspaceSubdomain })
    .from(schema.questionBankFieldConfigs)
    .where(eq(schema.questionBankFieldConfigs.workspaceSubdomain, tenant))
    .limit(1);
  if (field) return true;
  const [prefs] = await tx
    .select({ workspaceSubdomain: schema.questionBankModulePreferences.workspaceSubdomain })
    .from(schema.questionBankModulePreferences)
    .where(eq(schema.questionBankModulePreferences.workspaceSubdomain, tenant))
    .limit(1);
  return Boolean(prefs);
}

export async function runMigration073(): Promise<void> {
  const keys = await listObjectStorageKeys();
  const candidates: { key: string; tenant: string }[] = [];

  for (const key of keys) {
    const parsed = parseTenantScopedStorageKey(key);
    if (!parsed) continue;
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;
    if (parsed.logicalKey === SETTINGS_KEY) {
      candidates.push({ key, tenant });
    }
  }

  if (candidates.length === 0) {
    console.log("[Migration 073] No orphan Question Bank Setup object keys to clear.");
    return;
  }

  const toDelete: string[] = [];
  let skipped = 0;

  await withGlobalTenant(async (tx) => {
    const cache = new Map<string, boolean>();
    const hasSetup = async (tenant: string): Promise<boolean> => {
      const cached = cache.get(tenant);
      if (cached !== undefined) return cached;
      const value = await tenantHasTypedSetup(tx, tenant);
      cache.set(tenant, value);
      return value;
    };

    for (const candidate of candidates) {
      if (!(await hasSetup(candidate.tenant))) {
        skipped += 1;
        console.warn(
          `[Migration 073] Skipping "${candidate.key}": typed Question Bank Setup missing for tenant "${candidate.tenant}".`,
        );
        continue;
      }
      toDelete.push(candidate.key);
    }
  });

  for (const key of toDelete) {
    await deleteObjectByStorageKey(key);
    console.log(`[Migration 073] Deleted orphan object key "${key}".`);
  }

  if (toDelete.length === 0 && skipped === 0) {
    console.log("[Migration 073] No orphan Question Bank Setup object keys to clear.");
  } else {
    console.log(
      `[Migration 073] Removed ${toDelete.length} key(s); skipped ${skipped} unsafe key(s).`,
    );
  }
}
