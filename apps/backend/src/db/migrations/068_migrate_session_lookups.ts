import {
  parseTenantScopedStorageKey,
  SESSION_LOOKUP_LEGACY_COLLECTION_KEYS,
  isSessionLookupLegacyCollectionKey,
  type SessionLookupKind,
} from "@mms/shared";
import { and, eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";

function slugifyLabel(label: string, index: number): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "item"}-${index}`;
}

function normalizeStringItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && entry.trim()) {
      out.push(entry.trim());
      continue;
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const candidate =
        (typeof record.label === "string" && record.label) ||
        (typeof record.name === "string" && record.name) ||
        (typeof record.id === "string" && record.id) ||
        "";
      if (candidate.trim()) out.push(candidate.trim());
    }
  }
  return out;
}

/** One-shot backfill: tenant `collections` session* lookup keys → typed `session_lookups`. */
export async function runMigration068(): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(schema.collections);
  let migratedTenants = 0;
  let insertedRows = 0;

  for (const row of rows) {
    const parsed = parseTenantScopedStorageKey(row.name);
    if (!parsed) continue;
    const legacyKey = parsed.logicalKey;
    if (!isSessionLookupLegacyCollectionKey(legacyKey)) continue;
    const kind: SessionLookupKind = SESSION_LOOKUP_LEGACY_COLLECTION_KEYS[legacyKey];
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;

    const values = normalizeStringItems(row.data).map((label, index) => ({
      id: `${tenant}:${kind}:${slugifyLabel(label, index)}`,
      workspaceSubdomain: tenant,
      kind,
      label,
      meta: null as Record<string, unknown> | null,
      sortOrder: index,
      updatedAt: new Date(),
    }));

    if (values.length === 0) continue;

    const inserted = await withGlobalTenant(async (tx) => {
      const existing = await tx
        .select({ id: schema.sessionLookups.id })
        .from(schema.sessionLookups)
        .where(
          and(
            eq(schema.sessionLookups.workspaceSubdomain, tenant),
            eq(schema.sessionLookups.kind, kind),
          ),
        );
      const existingIds = new Set(existing.map((r) => r.id));
      const fresh = values.filter((v) => !existingIds.has(v.id));
      if (fresh.length === 0) return 0;

      await tx.insert(schema.sessionLookups).values(fresh).onConflictDoNothing();
      return fresh.length;
    });

    if (inserted === 0) continue;

    insertedRows += inserted;
    migratedTenants += 1;
    console.log(
      `[Migration 068] Migrated ${inserted} "${kind}" lookup rows for tenant "${tenant}".`,
    );
  }

  if (migratedTenants === 0) {
    console.log(
      `[Migration 068] No session lookup collections to migrate (legacy: ${Object.keys(SESSION_LOOKUP_LEGACY_COLLECTION_KEYS).join(", ")}).`,
    );
  } else {
    console.log(
      `[Migration 068] Done — ${insertedRows} rows across ${migratedTenants} tenant/kind batches.`,
    );
  }
}
