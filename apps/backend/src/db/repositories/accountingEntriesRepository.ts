import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { dedupeTrimmedIds, type JournalEntry } from "@mms/shared";
import { accountingEntries } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import {
  entryRowToRecord,
  accountingEntrySelectFields,
  fetchEntriesChildrenTx,
} from "./accountingEntriesHydrate.js";

export * from "./accountingEntriesHydrate.js";

export async function listEntriesByWorkspace(
  tenant: string,
  options?: {
    deleted?: "active" | "deleted" | "all";
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<JournalEntry[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(accountingEntries.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(accountingEntries.deletedAt)
          : isNull(accountingEntries.deletedAt);

    const conditions = [eq(accountingEntries.workspaceSubdomain, subdomain)];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select(accountingEntrySelectFields)
      .from(accountingEntries)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];

    const entryIds = rows.map((r) => r.id);
    const { linesByEntry, tagsByEntry, attachmentsByEntry } = await fetchEntriesChildrenTx(
      tx,
      subdomain,
      entryIds,
    );

    return rows.map((r) =>
      entryRowToRecord(
        r,
        linesByEntry.get(r.id) ?? [],
        tagsByEntry.get(r.id) ?? [],
        attachmentsByEntry.get(r.id) ?? [],
      ),
    );
  });
}

export async function findEntriesByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<JournalEntry[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(accountingEntries.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(accountingEntries.deletedAt)
          : isNull(accountingEntries.deletedAt);

    const conditions = [
      eq(accountingEntries.workspaceSubdomain, subdomain),
      inArray(accountingEntries.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select(accountingEntrySelectFields)
      .from(accountingEntries)
      .where(and(...conditions));
    if (rows.length === 0) return [];

    const foundIds = rows.map((r) => r.id);
    const { linesByEntry, tagsByEntry, attachmentsByEntry } = await fetchEntriesChildrenTx(
      tx,
      subdomain,
      foundIds,
    );

    return rows.map((r) =>
      entryRowToRecord(
        r,
        linesByEntry.get(r.id) ?? [],
        tagsByEntry.get(r.id) ?? [],
        attachmentsByEntry.get(r.id) ?? [],
      ),
    );
  });
}

export async function findEntryIdBySource(
  tenant: string,
  sourceType: string,
  sourceId: string,
): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingEntries.id })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          eq(accountingEntries.sourceType, sourceType),
          eq(accountingEntries.sourceId, sourceId),
          isNull(accountingEntries.deletedAt),
        ),
      )
      .limit(1);
    return rows[0]?.id ?? null;
  });
}

export async function findActiveEntryRefs(
  tenant: string,
  refs: readonly string[],
): Promise<Map<string, string>> {
  const cleanRefs = refs.map((r) => r?.trim()).filter((r): r is string => Boolean(r));
  const resultMap = new Map<string, string>();
  if (cleanRefs.length === 0) return resultMap;

  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingEntries.id, ref: accountingEntries.ref })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          inArray(accountingEntries.ref, cleanRefs),
          isNull(accountingEntries.deletedAt),
        ),
      );

    for (const row of rows) {
      resultMap.set(row.ref, row.id);
    }
    return resultMap;
  });
}

