import { eq, inArray, getTableName } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getRootDb } from "../database.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { redisDel, redisKeys } from "../../lib/redis.js";
import { getOrSetMultiTier, invalidateMultiTierCache } from "../../lib/cache/index.js";

type WorkspaceCol = PgColumn;
type UpdatedAtCol = PgColumn;

// Drizzle table params need dynamic column access on top of the typed columns
// declared at each call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic column lookup
type DynamicPgTable = PgTable & Record<string, any>;

const SETUP_SINGLETON_CACHE_TTL_SECONDS = 300;

/**
 * Workspace-scoped singleton JSONB row (field-config / module-preferences).
 * `jsonColumn` is the Drizzle property name on the table (`config` or `preferences`).
 */
export function createWorkspaceSingletonJsonRepo(options: {
  table: DynamicPgTable & {
    workspaceSubdomain: WorkspaceCol;
    updatedAt: UpdatedAtCol;
  };
  jsonColumn: "config" | "preferences";
}) {
  const { table, jsonColumn } = options;
  const tableName = getTableName(table);
  const cacheKey = (sub: string) => redisKeys.setupSingleton(sub, tableName, jsonColumn);

  async function getByWorkspace(
    workspaceSubdomain: string,
  ): Promise<Record<string, unknown> | null> {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    const key = cacheKey(subdomain);
    return getOrSetMultiTier(
      subdomain,
      tableName,
      key,
      async () => {
        const result = await withTenantRead(subdomain, async (tx) => {
          const rows = await tx
            .select({
              [jsonColumn]: table[jsonColumn],
            })
            .from(table)
            .where(eq(table.workspaceSubdomain, subdomain))
            .limit(1);
          const row = rows[0] as Record<string, unknown> | undefined;
          const value = row?.[jsonColumn];
          return value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
        });
        return result;
      },
      { ttlSeconds: SETUP_SINGLETON_CACHE_TTL_SECONDS },
    );
  }

  async function getByWorkspaces(
    workspaceSubdomains: string[],
  ): Promise<Map<string, Record<string, unknown>>> {
    const subdomains: string[] = [];
    const seenSubdomains = new Set<string>();
    for (let i = 0; i < workspaceSubdomains.length; i++) {
      const s = workspaceSubdomains[i];
      if (!s) continue;
      const normalized = s.trim().toLowerCase();
      if (normalized && !seenSubdomains.has(normalized)) {
        seenSubdomains.add(normalized);
        subdomains.push(normalized);
      }
    }
    const result = new Map<string, Record<string, unknown>>();
    if (subdomains.length === 0) return result;

    const db = getRootDb();
    const rows = await db
      .select({
        workspaceSubdomain: table.workspaceSubdomain,
        [jsonColumn]: table[jsonColumn],
      })
      .from(table)
      .where(inArray(table.workspaceSubdomain, subdomains));
    for (const row of rows as Record<string, unknown>[]) {
      const sub =
        typeof row?.workspaceSubdomain === "string" ? row.workspaceSubdomain.toLowerCase() : "";
      const value = row?.[jsonColumn];
      if (sub && value && typeof value === "object" && !Array.isArray(value)) {
        result.set(sub, value as Record<string, unknown>);
      }
    }
    return result;
  }

  async function upsert(workspaceSubdomain: string, json: Record<string, unknown>): Promise<void> {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    const now = new Date();
    await withTenant(subdomain, async (tx) => {
      await tx
        .insert(table)
        .values({
          workspaceSubdomain: subdomain,
          [jsonColumn]: json,
          updatedAt: now,
        } as never)
        .onConflictDoUpdate({
          target: table.workspaceSubdomain,
          set: { [jsonColumn]: json, updatedAt: now } as never,
        });
    });
    const key = cacheKey(subdomain);
    await invalidateMultiTierCache({ tenantId: subdomain, domain: tableName, key });
    await redisDel(key);
  }

  async function listAllByWorkspace(workspaceSubdomain: string) {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    return withTenant(subdomain, async (tx) => {
      return tx
        .select({
          workspaceSubdomain: table.workspaceSubdomain,
          [jsonColumn]: table[jsonColumn],
          updatedAt: table.updatedAt,
        })
        .from(table)
        .where(eq(table.workspaceSubdomain, subdomain));
    });
  }

  async function replaceForWorkspace(
    workspaceSubdomain: string,
    records: Array<Record<string, unknown>>,
  ): Promise<void> {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    const now = new Date();
    await withTenant(subdomain, async (tx) => {
      await tx.delete(table).where(eq(table.workspaceSubdomain, subdomain));
      const first = records[0];
      if (!first) return;
      const nested = first[jsonColumn];
      const json =
        nested && typeof nested === "object" && !Array.isArray(nested)
          ? (nested as Record<string, unknown>)
          : first;
      await tx.insert(table).values({
        workspaceSubdomain: subdomain,
        [jsonColumn]: json,
        updatedAt: now,
      } as never);
    });
    const key = cacheKey(subdomain);
    await invalidateMultiTierCache({ tenantId: subdomain, domain: tableName, key });
    await redisDel(key);
  }

  /** Drops the cached row — for callers that write it inside their own transaction. */
  async function evictCache(workspaceSubdomain: string): Promise<void> {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    const key = cacheKey(subdomain);
    await invalidateMultiTierCache({ tenantId: subdomain, domain: tableName, key });
    await redisDel(key);
  }

  return {
    getByWorkspace,
    getByWorkspaces,
    upsert,
    evictCache,
    listAllByWorkspace,
    replaceForWorkspace,
  };
}
