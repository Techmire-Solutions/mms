import { asc, gt, sql } from "drizzle-orm";
import {
  WORKSPACES_COLLECTION,
  PLATFORM_SUPER_USERS_OBJECT_KEY,
  isBackupExcludedObjectKey,
  isServerOnlyObjectKey,
  parseTenantScopedStorageKey,
} from "@mms/shared";
import * as schema from "./schema.js";
import { generateSnapshotJsonFromSource } from "../lib/streamingSnapshotJson.js";
import {
  withActiveTransaction,
  type DbClient,
  type LongLivedTenantTransaction,
} from "./dbConnection.js";
import { RELATIONAL_REPLACE_MAPPING } from "./relationalReplaceMapping.js";
import { stripCredentials } from "./relationalSnapshot.js";
import { collectAssetUrlsFromValue, readAssetBase64 } from "../services/backupAssetService.js";
import { logger } from "../lib/logger.js";

const PAGE_SIZE = 200;

/**
 * Yields `[logicalKey, rows][]` for the tenant's document-store collections, page
 * by page, mirroring `getAllData`'s tenant-scoping and `sanitizeSnapshot`'s
 * `WORKSPACES_COLLECTION` exclusion. Uses keyset pagination on `name` (primary key)
 * to guarantee $O(1)$ page traversal without offset scanning overhead.
 */
export async function* pageTenantCollections(
  tx: DbClient,
  subdomain: string | null,
): AsyncGenerator<[string, AsyncIterable<unknown>]> {
  const tenant = subdomain?.trim().toLowerCase() || "";
  let lastSeenName: string | null = null;
  for (;;) {
    const baseQuery = tx
      .select({ name: schema.collections.name }) // Exclude data to avoid buffering huge JSON
      .from(schema.collections);

    const rows = await (
      lastSeenName ? baseQuery.where(gt(schema.collections.name, lastSeenName)) : baseQuery
    )
      .orderBy(asc(schema.collections.name))
      .limit(PAGE_SIZE);

    if (rows.length === 0) break;
    lastSeenName = rows[rows.length - 1].name;

    for (const row of rows) {
      if (row.name === WORKSPACES_COLLECTION) continue;
      const parsed = parseTenantScopedStorageKey(row.name);
      if (tenant && (!parsed || parsed.subdomain !== tenant)) continue;
      const logicalKey = parsed ? parsed.logicalKey : row.name;

      async function* streamCollectionData(): AsyncIterable<unknown> {
        const CHUNK = 500;
        // Read the legacy array once; the previous OFFSET above
        // jsonb_array_elements re-parsed the whole array for every page (O(n²)).
        const result = await tx.execute(
          sql`SELECT data FROM ${schema.collections} WHERE name = ${row.name}`,
        );
        const data = (result.rows[0] as { data?: unknown } | undefined)?.data;
        const items = Array.isArray(data) ? data : [];
        if (items.length > 100_000) {
          logger.warn(
            { collection: row.name, size: items.length },
            "Legacy JSONB collection exceeds 100k elements; streaming from memory",
          );
        }
        for (let i = 0; i < items.length; i += CHUNK) {
          for (const item of items.slice(i, i + CHUNK)) yield item;
        }
      }

      yield [logicalKey, streamCollectionData()];
    }

    if (rows.length < PAGE_SIZE) break;
  }
}

/**
 * Yields `[logicalKey, value][]` for the tenant's document-store objects, page by
 * page, mirroring `getAllData` (server-only + backup-excluded key exclusion) and
 * `sanitizeSnapshot` (platform super-users exclusion). Uses keyset pagination on
 * `key` (primary key) to guarantee $O(1)$ page traversal.
 */
export async function* pageTenantObjects(
  tx: DbClient,
  subdomain: string | null,
): AsyncGenerator<[string, unknown]> {
  const tenant = subdomain?.trim().toLowerCase() || "";
  let lastSeenKey: string | null = null;
  for (;;) {
    const baseQuery = tx
      .select({ key: schema.objects.key, data: schema.objects.data })
      .from(schema.objects);

    const rows = await (
      lastSeenKey ? baseQuery.where(gt(schema.objects.key, lastSeenKey)) : baseQuery
    )
      .orderBy(asc(schema.objects.key))
      .limit(PAGE_SIZE);

    if (rows.length === 0) break;
    lastSeenKey = rows[rows.length - 1].key;

    for (const row of rows) {
      const parsed = parseTenantScopedStorageKey(row.key);
      const logicalKey = parsed?.logicalKey ?? row.key;
      if (isServerOnlyObjectKey(logicalKey)) continue;
      if (isBackupExcludedObjectKey(logicalKey)) continue;
      if (logicalKey === PLATFORM_SUPER_USERS_OBJECT_KEY) continue;
      if (tenant) {
        if (!parsed || parsed.subdomain !== tenant) continue;
        yield [parsed.logicalKey, row.data];
      } else if (!parsed) {
        yield [row.key, row.data];
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }
}

export interface StreamDocStoreOptions {
  subdomain: string | null;
  /** Extra objects to emit after the document-store objects (e.g. branding, settings). */
  extraObjects?: AsyncIterable<[string, unknown]>;
}

/**
 * Streams the tenant snapshot JSON (collections + objects [+ extra objects]) from
 * the open transaction's tables, delegating serialization to the shared streaming
 * writer. Caller is responsible for driving the generator to completion inside the
 * long-lived transaction and for committing/rolling back in a `finally`.
 */
export async function* streamTenantDocStoreSnapshot(
  tx: DbClient,
  options: StreamDocStoreOptions,
): AsyncGenerator<string, void, unknown> {
  yield* generateSnapshotJsonFromSource({
    collections: pageTenantCollections(tx, options.subdomain),
    objects: (async function* mergeObjects() {
      yield* pageTenantObjects(tx, options.subdomain);
      if (options.extraObjects) {
        yield* options.extraObjects;
      }
    })(),
  });
}

/**
 * Streams the client-facing `/api/db/sync` snapshot: tenant doc-store collections
 * + objects, plus `branding` and masked `global_settings`, byte-equivalent to
 * `sanitizeSnapshot(fetchDatabaseSnapshot())`. Branding/settings load through the
 * long-lived transaction (via `activeDb()`), so the whole stream reads one
 * consistent snapshot. Caller commits in a `finally` after driving to completion.
 */
export async function* streamSyncSnapshot(
  txn: LongLivedTenantTransaction,
  tenant: string | null,
): AsyncGenerator<string, void, unknown> {
  const extraObjects: [string, unknown][] = [];
  if (tenant) {
    await withActiveTransaction(txn.tx, async () => {
      const [
        { getWorkspaceBranding, getWorkspaceGlobalSettings },
        { maskGlobalSettingsForClient },
      ] = await Promise.all([
        import("./repositories/workspaceRepository.js"),
        import("../services/globalSettingsService.js"),
      ]);
      const [branding, globalSettings] = await Promise.all([
        getWorkspaceBranding(tenant),
        getWorkspaceGlobalSettings(tenant),
      ]);
      if (branding) extraObjects.push(["branding", branding]);
      if (globalSettings) {
        extraObjects.push(["global_settings", maskGlobalSettingsForClient(globalSettings)]);
      }
    });
  }
  async function* extraIter(): AsyncGenerator<[string, unknown], void, undefined> {
    for (const entry of extraObjects) yield entry;
  }
  yield* streamTenantDocStoreSnapshot(txn.tx, { subdomain: tenant, extraObjects: extraIter() });
}

/**
 * Streams the full-fidelity `/api/db/backup` snapshot, byte-equivalent to
 * `sanitizeSnapshot(fetchBackupSnapshot())`:
 * - doc-store collections (skipping relational-overridden keys) + every relational
 *   table, one table at a time (each table's rows are released before the next);
 * - doc-store objects + branding + full global_settings + email_integration;
 * - referenced upload assets, read from disk one at a time.
 *
 * The caller must keep the long-lived transaction active and commit/roll back
 * in a `finally` so every loader joins the same snapshot.
 */
export async function* streamBackupSnapshot(
  txn: LongLivedTenantTransaction,
  tenant: string | null,
): AsyncGenerator<string, void, unknown> {
  const tx = txn.tx;
  const assetUrls = new Set<string>();

  const relationalKeys = new Set(
    Object.entries(RELATIONAL_REPLACE_MAPPING)
      .filter(([, mapping]) => Boolean(mapping.snapshotFnName))
      .map(([key]) => key),
  );

  async function* collections(): AsyncGenerator<[string, unknown[] | AsyncIterable<unknown>]> {
    for await (const [key, rows] of pageTenantCollections(tx, tenant)) {
      if (relationalKeys.has(key)) continue;
      collectAssetUrlsFromValue(rows, assetUrls);
      yield [key, rows];
    }
    for (const [key, mapping] of Object.entries(RELATIONAL_REPLACE_MAPPING)) {
      if (!mapping.snapshotFnName) continue;
      const repo = (await import(mapping.importPath)) as Record<string, unknown>;
      const listRows = repo[mapping.snapshotFnName] as (
        subdomain: string,
        options?: { limit?: number; offset?: number },
      ) => Promise<unknown[]>;

      async function* streamTableRows(): AsyncGenerator<unknown, void, unknown> {
        const CHUNK_SIZE = 250;
        let offset = 0;
        const seenIds = new Set<string>();
        for (;;) {
          const chunk = await listRows(tenant ?? "", { limit: CHUNK_SIZE, offset });
          if (!Array.isArray(chunk) || chunk.length === 0) break;
          const cleaned = stripCredentials(chunk);
          for (const item of cleaned) {
            const id = (item as { id?: unknown } | null)?.id;
            if (id !== undefined && id !== null) {
              const idKey = String(id);
              if (seenIds.has(idKey)) {
                throw new Error(
                  `Backup snapshot paging returned id "${idKey}" twice for collection "${key}"; ` +
                    "refusing to emit a corrupt backup (add ORDER BY id to the snapshot loader).",
                );
              }
              seenIds.add(idKey);
            }
          }
          collectAssetUrlsFromValue(cleaned, assetUrls);
          for (const item of cleaned) {
            yield item;
          }
          if (chunk.length < CHUNK_SIZE) break;
          offset += CHUNK_SIZE;
        }
      }

      yield [key, streamTableRows()];
    }
  }

  async function* objects(): AsyncGenerator<[string, unknown]> {
    for await (const [key, value] of pageTenantObjects(tx, tenant)) {
      collectAssetUrlsFromValue(value, assetUrls);
      yield [key, value];
    }
    if (tenant) {
      const extra: Array<[string, unknown]> = [];
      await withActiveTransaction(tx, async () => {
        const { getWorkspaceBranding, getWorkspaceGlobalSettings } =
          await import("./repositories/workspaceRepository.js");
        const [branding, globalSettings] = await Promise.all([
          getWorkspaceBranding(tenant),
          getWorkspaceGlobalSettings(tenant),
        ]);
        if (branding) {
          collectAssetUrlsFromValue(branding, assetUrls);
          extra.push(["branding", branding]);
        }
        if (globalSettings) extra.push(["global_settings", globalSettings]);
        // email_integration is server-only and intentionally omitted.
      });
      for (const entry of extra) yield entry;
    }
  }

  async function* assets(): AsyncGenerator<[string, string]> {
    for (const url of assetUrls) {
      const base64 = await readAssetBase64(url);
      if (base64 != null) yield [url, base64];
    }
  }

  yield* generateSnapshotJsonFromSource({
    collections: collections(),
    objects: objects(),
    assets: assets(),
  });
}
