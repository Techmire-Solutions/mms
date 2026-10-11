import {
  parseTenantScopedStorageKey,
  ATTENDANCE_LOOKUP_LEGACY_COLLECTION_KEYS,
  isAttendanceLookupLegacyCollectionKey,
  type AttendanceLookupKind,
} from "@mms/shared";
import { and, eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";

type NormalizedAttendanceItem = {
  id: string;
  label: string;
  short: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
};

function normalizeAttendanceItems(raw: unknown): NormalizedAttendanceItem[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedAttendanceItem[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const candidateId = typeof record.id === "string" ? record.id : undefined;
      const candidateLabel = typeof record.label === "string" ? record.label : undefined;
      if (candidateId && candidateLabel) {
        out.push({
          id: candidateId,
          label: candidateLabel,
          short:
            typeof record.short === "string"
              ? record.short
              : candidateLabel.charAt(0).toUpperCase(),
          color: typeof record.color === "string" ? record.color : "muted",
          bg: typeof record.bg === "string" ? record.bg : "bg-muted",
          text: typeof record.text === "string" ? record.text : "text-muted-foreground",
          border: typeof record.border === "string" ? record.border : "border-border",
          dot: typeof record.dot === "string" ? record.dot : "bg-muted-foreground",
        });
      }
    }
  }
  return out;
}

/** One-shot backfill: tenant `collections` attendance* lookup keys → typed `attendance_lookups`. */
export async function runMigration070(): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(schema.collections);
  let migratedTenants = 0;
  let insertedRows = 0;

  for (const row of rows) {
    const parsed = parseTenantScopedStorageKey(row.name);
    if (!parsed) continue;
    const legacyKey = parsed.logicalKey;
    if (!isAttendanceLookupLegacyCollectionKey(legacyKey)) continue;
    const kind: AttendanceLookupKind = ATTENDANCE_LOOKUP_LEGACY_COLLECTION_KEYS[legacyKey];
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;

    const values = normalizeAttendanceItems(row.data).map((item, index) => ({
      id: `${tenant}:${kind}:${item.id}`,
      workspaceSubdomain: tenant,
      kind,
      label: item.label,
      meta: {
        short: item.short,
        color: item.color,
        bg: item.bg,
        text: item.text,
        border: item.border,
        dot: item.dot,
      } as Record<string, unknown>,
      sortOrder: index,
      updatedAt: new Date(),
    }));

    if (values.length === 0) continue;

    const inserted = await withGlobalTenant(async (tx) => {
      const existing = await tx
        .select({ id: schema.attendanceLookups.id })
        .from(schema.attendanceLookups)
        .where(
          and(
            eq(schema.attendanceLookups.workspaceSubdomain, tenant),
            eq(schema.attendanceLookups.kind, kind),
          ),
        );
      const existingIds = new Set(existing.map((r) => r.id));
      const fresh = values.filter((v) => !existingIds.has(v.id));
      if (fresh.length === 0) return 0;

      await tx.insert(schema.attendanceLookups).values(fresh).onConflictDoNothing();
      return fresh.length;
    });

    if (inserted === 0) continue;

    insertedRows += inserted;
    migratedTenants += 1;
    console.log(
      `[Migration 070] Migrated ${inserted} "${kind}" lookup rows for tenant "${tenant}".`,
    );
  }

  if (migratedTenants === 0) {
    console.log(
      `[Migration 070] No attendance lookup collections to migrate (legacy: ${Object.keys(ATTENDANCE_LOOKUP_LEGACY_COLLECTION_KEYS).join(", ")}).`,
    );
  } else {
    console.log(
      `[Migration 070] Done — ${insertedRows} rows across ${migratedTenants} tenant/kind batches.`,
    );
  }
}
