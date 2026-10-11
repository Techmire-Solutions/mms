import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Faculty domain structural verification against a real PostgreSQL instance.
 *
 * Proves the teachers → faculty rename (0112/0119/0120/0122) plus the residual
 * cleanup (0130) left the database in the intended end state: the renamed table
 * carries its composite PK, NOT NULL contact link, RESTRICT foreign key, RLS
 * posture, and renamed trigger — and no legacy `teacher*` table, view, column,
 * index, or trigger survives.
 */

async function queryRows<T>(statement: string): Promise<T[]> {
  const tx = await beginLongLivedTenantTransaction(null);
  try {
    const result = await tx.tx.execute(sql.raw(statement));
    await tx.rollback();
    return result.rows as T[];
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
});

afterAll(async () => {
  await closeDatabase();
});

describe("faculty domain database structure", () => {
  it("has the faculty table and no legacy teachers table or compatibility views", async () => {
    const tables = await queryRows<{ name: string | null }>(
      `SELECT to_regclass('public.faculty') AS name`,
    );
    expect(tables[0]?.name).toBe("faculty");

    const legacyRelations = await queryRows<{ relname: string }>(
      `SELECT relname FROM pg_class
       WHERE relnamespace = 'public'::regnamespace
         AND relname IN ('teachers', 'teacher_lookups', 'teacher_field_configs',
                         'teacher_module_preferences', 'teacher_setup_config')`,
    );
    expect(legacyRelations).toEqual([]);
  });

  it("keeps the composite primary key (workspace_subdomain, id)", async () => {
    const columns = await queryRows<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
        AND kcu.table_name = tc.table_name
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'faculty'
         AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position`,
    );
    expect(columns.map((row) => row.column_name)).toEqual(["workspace_subdomain", "id"]);
  });

  it("enforces NOT NULL contact_id with an ON DELETE RESTRICT foreign key to contacts", async () => {
    const nullable = await queryRows<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'faculty_employments' AND column_name = 'contact_id'`,
    );
    expect(nullable[0]?.is_nullable).toBe("NO");

    const fk = await queryRows<{ delete_rule: string }>(
      `SELECT rc.delete_rule
       FROM information_schema.referential_constraints rc
       WHERE rc.constraint_schema = 'public'
         AND rc.constraint_name = 'faculty_employments_contact_fk'`,
    );
    expect(fk[0]?.delete_rule).toBe("RESTRICT");
  });

  it("renamed the updated_at trigger to update_faculty_updated_at", async () => {
    const triggers = await queryRows<{ tgname: string }>(
      `SELECT t.tgname FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'faculty' AND NOT t.tgisinternal`,
    );
    const names = triggers.map((row) => row.tgname);
    expect(names).toContain("update_faculty_updated_at");
    expect(names).toContain("trg_faculty_forbid_hard_delete");
    expect(names).not.toContain("update_teachers_updated_at");
    expect(names).not.toContain("trg_teachers_forbid_hard_delete");
  });

  it("keeps row level security enabled and forced with the soft-delete isolation policy", async () => {
    const rls = await queryRows<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'faculty'`,
    );
    expect(rls[0]?.relrowsecurity).toBe(true);
    expect(rls[0]?.relforcerowsecurity).toBe(true);

    const policies = await queryRows<{ polname: string }>(
      `SELECT p.polname FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'faculty'`,
    );
    expect(policies.map((row) => row.polname)).toContain("tenant_soft_delete_isolation");
  });

  it("renamed dependent columns in session_classes and hasanat_distributions", async () => {
    const columns = await queryRows<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND ((table_name = 'session_classes' AND column_name IN ('faculty_id', 'teacher_id'))
           OR (table_name = 'hasanat_distributions' AND column_name IN ('recipient_faculty_id', 'recipient_teacher_id')))`,
    );
    const present = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
    expect(present).toContain("session_classes.faculty_id");
    expect(present).toContain("hasanat_distributions.recipient_faculty_id");
    expect(present).not.toContain("session_classes.teacher_id");
    expect(present).not.toContain("hasanat_distributions.recipient_teacher_id");
  });

  it("carries faculty-named indexes and no teachers_-named index anywhere", async () => {
    const indexes = await queryRows<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'faculty'`,
    );
    const names = indexes.map((row) => row.indexname);
    expect(names).toContain("faculty_workspace_active_idx");
    expect(names).toContain("faculty_workspace_profile_status_active_idx");

    const legacyIndexes = await queryRows<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname LIKE '%teacher%'`,
    );
    expect(legacyIndexes).toEqual([]);
  });
});
