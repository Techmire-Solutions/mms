import { and, eq } from "drizzle-orm";
import { dashboardPreferences } from "@mms/db/schema";
import { withTenant, withTenantRead } from "@mms/db/context";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: dashboardPreferences,
  jsonColumn: "preferences",
});

export const getDashboardPreferencesByWorkspace = repo.getByWorkspace;
export const upsertDashboardPreferences = repo.upsert;
export const listAllDashboardPreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceDashboardPreferencesForWorkspace = repo.replaceForWorkspace;
export const evictDashboardPreferencesCache = repo.evictCache;

export interface DashboardPreferencesWithToken {
  preferences: Record<string, unknown> | null;
  updatedAt: Date | null;
}

/**
 * Reads the singleton plus its `updated_at` optimistic-concurrency token.
 * Deliberately bypasses the json-only multi-tier cache so the caller always
 * gets the authoritative token to echo back.
 */
export async function getDashboardPreferencesWithUpdatedAt(
  workspaceSubdomain: string,
): Promise<DashboardPreferencesWithToken> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({
        preferences: dashboardPreferences.preferences,
        updatedAt: dashboardPreferences.updatedAt,
      })
      .from(dashboardPreferences)
      .where(eq(dashboardPreferences.workspaceSubdomain, subdomain))
      .limit(1);
    return {
      preferences: row?.preferences ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/**
 * Compare-and-set on `updated_at` (mirrors `documentTemplatesRepository`).
 *
 * `expectedUpdatedAt === null` means the caller read no stored row, so only an
 * insert is acceptable; a row created in between is a conflict. Returns `null`
 * when the expectation no longer matches — the caller maps that to 409 and the
 * stored document is left untouched.
 *
 * Atomic per statement (no read-then-write window). All writers set `updatedAt`
 * from a JS `Date` (millisecond precision), which is exactly what the client
 * echoes back, so timestamp equality is exact.
 */
export async function saveDashboardPreferencesCas(
  workspaceSubdomain: string,
  preferences: Record<string, unknown>,
  expectedUpdatedAt: Date | null,
): Promise<{ preferences: Record<string, unknown>; updatedAt: Date } | null> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const now = new Date();

  const result = await withTenant(subdomain, async (tx) => {
    if (expectedUpdatedAt === null) {
      const [row] = await tx
        .insert(dashboardPreferences)
        .values({ workspaceSubdomain: subdomain, preferences, updatedAt: now })
        .onConflictDoNothing({ target: dashboardPreferences.workspaceSubdomain })
        .returning({
          preferences: dashboardPreferences.preferences,
          updatedAt: dashboardPreferences.updatedAt,
        });
      return row ?? null;
    }

    const [row] = await tx
      .update(dashboardPreferences)
      .set({ preferences, updatedAt: now })
      .where(
        and(
          eq(dashboardPreferences.workspaceSubdomain, subdomain),
          eq(dashboardPreferences.updatedAt, expectedUpdatedAt),
        ),
      )
      .returning({
        preferences: dashboardPreferences.preferences,
        updatedAt: dashboardPreferences.updatedAt,
      });
    return row ?? null;
  });

  if (!result) return null;
  await repo.evictCache(subdomain);
  return {
    preferences: result.preferences as Record<string, unknown>,
    updatedAt: result.updatedAt,
  };
}
