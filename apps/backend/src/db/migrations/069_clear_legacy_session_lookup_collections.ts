/**
 * Deletes orphan document-store Session lookup collections after typed-table backfill (068).
 * Safe to re-run: skips delete when typed `session_lookups` rows are missing for that
 * (tenant, kind) — avoids wiping legacy data if 068 partially failed.
 */
import {
  parseTenantScopedStorageKey,
  isSessionLookupLegacyCollectionKey,
  SESSION_LOOKUP_LEGACY_COLLECTION_KEYS,
  type SessionLookupKind,
} from "@mms/shared";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";

export async function runMigration069(): Promise<void> {
  const db = getDb();
  const allRows = await db.select({ name: schema.collections.name }).from(schema.collections);

  type Candidate = { name: string; tenant: string; kind: SessionLookupKind };
  const candidates: Candidate[] = [];

  for (const r of allRows) {
    const parsed = parseTenantScopedStorageKey(r.name);
    if (!parsed) continue;
    if (!isSessionLookupLegacyCollectionKey(parsed.logicalKey)) continue;
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;
    candidates.push({
      name: r.name,
      tenant,
      kind: SESSION_LOOKUP_LEGACY_COLLECTION_KEYS[parsed.logicalKey],
    });
  }

  if (candidates.length === 0) {
    console.log("[Migration 069] No legacy session lookup collections found to delete.");
    return;
  }

  const toDelete: string[] = [];
  let skipped = 0;

  await withGlobalTenant(async (tx) => {
    const cache = new Map<string, boolean>();
    const hasTyped = async (tenant: string, kind: SessionLookupKind): Promise<boolean> => {
      const cacheKey = `${tenant}:${kind}`;
      const cached = cache.get(cacheKey);
      if (cached !== undefined) return cached;
      const [row] = await tx
        .select({ id: schema.sessionLookups.id })
        .from(schema.sessionLookups)
        .where(
          and(
            eq(schema.sessionLookups.workspaceSubdomain, tenant),
            eq(schema.sessionLookups.kind, kind),
          ),
        )
        .limit(1);
      const value = Boolean(row);
      cache.set(cacheKey, value);
      return value;
    };

    for (const candidate of candidates) {
      if (!(await hasTyped(candidate.tenant, candidate.kind))) {
        skipped += 1;
        console.warn(
          `[Migration 069] Skipping "${candidate.name}": typed session_lookups missing for tenant "${candidate.tenant}" kind "${candidate.kind}".`,
        );
        continue;
      }
      toDelete.push(candidate.name);
    }

    const chunkSize = 100;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      await tx.delete(schema.collections).where(inArray(schema.collections.name, chunk));
    }
  });

  console.log(
    `[Migration 069] Removed ${toDelete.length} legacy session lookup collection(s); skipped ${skipped} unsafe.`,
  );
}
