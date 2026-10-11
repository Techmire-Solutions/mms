import { and, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { withTenant } from "../tenant-context.js";

type WorkspaceCol = PgColumn;

// Drizzle table params need dynamic column access on top of the typed columns
// declared at each call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic column lookup
type DynamicPgTable = PgTable & Record<string, any>;

/** Per-user Work column preference rows. */
export function createUserColumnPrefsRepo(options: {
  table: DynamicPgTable & {
    workspaceSubdomain: WorkspaceCol;
    userId: WorkspaceCol;
    preferences: PgColumn;
    updatedAt: PgColumn;
  };
}) {
  const { table } = options;

  async function get(workspaceSubdomain: string, userId: string): Promise<unknown[]> {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    const uid = userId.trim();
    return withTenant(subdomain, async (tx) => {
      const rows = await tx
        .select({ preferences: table.preferences })
        .from(table)
        .where(and(eq(table.workspaceSubdomain, subdomain), eq(table.userId, uid)))
        .limit(1);
      const row = rows[0] as { preferences?: unknown } | undefined;
      return Array.isArray(row?.preferences) ? row.preferences : [];
    });
  }

  async function set(
    workspaceSubdomain: string,
    userId: string,
    preferences: unknown[],
  ): Promise<void> {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    const uid = userId.trim();
    const now = new Date();
    await withTenant(subdomain, async (tx) => {
      await tx
        .insert(table)
        .values({
          workspaceSubdomain: subdomain,
          userId: uid,
          preferences,
          updatedAt: now,
        } as never)
        .onConflictDoUpdate({
          target: [table.workspaceSubdomain, table.userId],
          set: { preferences, updatedAt: now } as never,
        });
    });
  }

  async function listAllByWorkspace(workspaceSubdomain: string) {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    return withTenant(subdomain, async (tx) => {
      return tx
        .select({
          workspaceSubdomain: table.workspaceSubdomain,
          userId: table.userId,
          preferences: table.preferences,
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
      if (records.length === 0) return;
      await tx.insert(table).values(
        records.map((record) => ({
          workspaceSubdomain: subdomain,
          userId: String(record.userId ?? record.user_id ?? ""),
          preferences: Array.isArray(record.preferences) ? record.preferences : [],
          updatedAt: now,
        })) as never,
      );
    });
  }

  return { get, set, listAllByWorkspace, replaceForWorkspace };
}
