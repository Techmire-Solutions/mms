import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase, getRootDb } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Guards the soft-delete safety net: every base table carrying a `deleted_at`
 * column MUST have a `forbid_hard_delete()` trigger, otherwise a manual
 * `DELETE` (or a forgotten application path) can physically destroy a record
 * that the rest of the system assumes is only ever archived.
 *
 * The trigger list in `0108_soft_delete_schema_rls_and_triggers.sql` (and later
 * migrations) is hand-maintained, so a newly soft-deletable table that is not
 * wired up would otherwise go unnoticed.
 */
beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
});

afterAll(async () => {
  await closeDatabase();
});

describe("soft-delete hard-delete trigger coverage", () => {
  it("every table with a deleted_at column has a forbid_hard_delete trigger", async () => {
    const db = getRootDb();

    const softDeleteTables = await db.execute(sql`
      SELECT c.table_name AS table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'deleted_at'
        AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name
    `);

    const triggerTables = await db.execute(sql`
      SELECT rel.relname AS table_name
      FROM pg_trigger tg
      JOIN pg_class rel ON rel.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND NOT tg.tgisinternal
        AND tg.tgname LIKE '%forbid_hard_delete%'
    `);

    const guarded = new Set(
      (triggerTables.rows as Array<{ table_name: string }>).map((r) => r.table_name),
    );
    const unguarded = (softDeleteTables.rows as Array<{ table_name: string }>)
      .map((r) => r.table_name)
      .filter((table) => !guarded.has(table));

    expect(unguarded).toEqual([]);
  });
});
