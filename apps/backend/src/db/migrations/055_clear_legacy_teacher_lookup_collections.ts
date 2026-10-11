/**
 * Deletes orphan document-store Teachers lookup collections after typed backfill (054).
 * Safe to re-run: skips delete when typed `teacher_lookups` has no rows for that tenant+kind.
 */
import { parseTenantScopedStorageKey } from "@mms/shared";
import { and, eq } from "drizzle-orm";
import * as schema from "../schema.js";
import { deleteCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { withGlobalTenant } from "../tenant-context.js";

const TEACHER_LOOKUP_LEGACY_COLLECTION_KEYS = {
  teacherStatuses: "statuses",
  teacherSpecializations: "specializations",
} as const;

type LegacyTeacherLookupKey = keyof typeof TEACHER_LOOKUP_LEGACY_COLLECTION_KEYS;

function isTeacherLookupLegacyCollectionKey(key: string): key is LegacyTeacherLookupKey {
  return key in TEACHER_LOOKUP_LEGACY_COLLECTION_KEYS;
}

type TeacherLookupKind = (typeof TEACHER_LOOKUP_LEGACY_COLLECTION_KEYS)[LegacyTeacherLookupKey];

async function tenantHasTypedLookupKind(tenant: string, kind: TeacherLookupKind): Promise<boolean> {
  return withGlobalTenant(async (tx) => {
    const [row] = await tx
      .select({ id: schema.facultyLookups.id })
      .from(schema.facultyLookups)
      .where(
        and(
          eq(schema.facultyLookups.workspaceSubdomain, tenant),
          eq(schema.facultyLookups.kind, kind),
        ),
      )
      .limit(1);
    return Boolean(row);
  });
}

export async function runMigration055(): Promise<void> {
  const names = await listCollectionStorageNames();
  let removed = 0;
  let skipped = 0;

  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    if (!parsed) continue;
    const legacyKey = parsed.logicalKey;
    if (!isTeacherLookupLegacyCollectionKey(legacyKey)) continue;
    const kind = TEACHER_LOOKUP_LEGACY_COLLECTION_KEYS[legacyKey];
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;

    const hasTyped = await tenantHasTypedLookupKind(tenant, kind);
    if (!hasTyped) {
      skipped += 1;
      console.warn(
        `[Migration 055] Skipping "${name}": typed teacher_lookups kind "${kind}" empty for "${tenant}".`,
      );
      continue;
    }

    await deleteCollectionByStorageName(name);
    removed += 1;
    console.log(`[Migration 055] Deleted legacy lookup collection "${name}".`);
  }

  if (removed === 0 && skipped === 0) {
    console.log("[Migration 055] No legacy teacher lookup collections to clear.");
  } else {
    console.log(`[Migration 055] Removed ${removed} key(s); skipped ${skipped} unsafe key(s).`);
  }
}
