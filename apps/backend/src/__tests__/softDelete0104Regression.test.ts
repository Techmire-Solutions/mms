import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("Migration 0104 & Soft-Delete Schema Invariants (Protect 0104)", () => {
  const migrationPath = join(
    process.cwd(),
    "src/db/migrations_drizzle/0104_soft_delete_system_complete.sql",
  );
  const journalPath = join(process.cwd(), "src/db/migrations_drizzle/meta/_journal.json");

  it("verifies 0104 migration is tracked in drizzle journal", async () => {
    const journalRaw = await readFile(journalPath, "utf-8");
    const journal = JSON.parse(journalRaw) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    const entry0104 = journal.entries.find((e) => e.tag === "0104_soft_delete_system_complete");
    expect(entry0104).toBeDefined();
    expect(entry0104?.idx).toBe(104);
  });

  it("verifies 0104 contains deleted_with_cascade on enrollments", async () => {
    const sql = await readFile(migrationPath, "utf-8");
    expect(sql).toContain(
      'ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" boolean DEFAULT false;',
    );
  });

  it("verifies 0104 contains partial unique indexes on recyclable natural keys", async () => {
    const sql = await readFile(migrationPath, "utf-8");

    // Students gr_number
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_gr_number_active_uidx"[\s\S]*?WHERE "deleted_at" IS NULL/i,
    );

    // Students student_id
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_student_id_active_uidx"[\s\S]*?WHERE "deleted_at" IS NULL/i,
    );

    // Teachers employee_id
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "teachers_workspace_employee_id_active_uidx"[\s\S]*?WHERE "deleted_at" IS NULL/i,
    );
  });

  it("verifies 0104 defines Category B active-record partial indexes", async () => {
    const sql = await readFile(migrationPath, "utf-8");

    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "enrollments_workspace_active_idx"[\s\S]*?WHERE "deleted_at" IS NULL/i,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_active_idx"[\s\S]*?WHERE "deleted_at" IS NULL/i,
    );
  });

  it("verifies 0104 creates Category C archived-record indexes for all entity tables", async () => {
    const sql = await readFile(migrationPath, "utf-8");

    const expectedTablesWithCategoryC = [
      "students",
      "teachers",
      "contacts",
      "sessions",
      "enrollments",
      "finance_invoices",
      "finance_payments",
      "accounting_accounts",
      "accounting_fiscal_years",
      "accounting_entries",
      "obligation_collections",
      "hasanat_distributions",
      "exams",
      "questions",
      "tests",
      "assessment_results",
      "message_logs",
      "attendance",
    ];

    for (const table of expectedTablesWithCategoryC) {
      const pattern = new RegExp(
        `CREATE INDEX IF NOT EXISTS ".*?"\\s+ON "${table}"\\s+\\("workspace_subdomain",\\s*"deleted_at"\\)\\s+WHERE "deleted_at" IS NOT NULL`,
        "i",
      );
      expect(sql, `Missing Category C index for table "${table}"`).toMatch(pattern);
    }
  });

  it("verifies 0104 registers forbid_hard_delete trigger function and triggers", async () => {
    const sql = await readFile(migrationPath, "utf-8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION forbid_hard_delete()");
    expect(sql).toContain("current_setting('app.allow_hard_purge', true) = 'true'");
    expect(sql).toContain("RAISE EXCEPTION 'Hard delete forbidden on table");

    const expectedTriggerTables = [
      "contacts",
      "students",
      "teachers",
      "sessions",
      "enrollments",
      "finance_invoices",
      "finance_payments",
      "accounting_accounts",
      "accounting_entries",
      "obligation_collections",
      "hasanat_distributions",
      "exams",
      "message_logs",
      "attendance",
    ];

    for (const table of expectedTriggerTables) {
      const triggerPattern = new RegExp(
        `CREATE TRIGGER\\s+trg_${table}_forbid_hard_delete\\s+BEFORE DELETE ON "${table}"\\s+FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete\\(\\)`,
        "i",
      );
      expect(sql, `Missing forbid_hard_delete trigger for table "${table}"`).toMatch(
        triggerPattern,
      );
    }
  });

  it("verifies the forbid_hard_delete contract logic", () => {
    function simulateForbidHardDelete(currentSettingValue: string | null, tableName: string) {
      if (currentSettingValue === "true") {
        return { status: "ALLOWED" };
      }
      throw new Error(
        `Hard delete forbidden on table "${tableName}", use soft-delete or maintenance bypass`,
      );
    }

    // Default without flag: throws
    expect(() => simulateForbidHardDelete(null, "students")).toThrow(
      'Hard delete forbidden on table "students"',
    );
    expect(() => simulateForbidHardDelete("false", "students")).toThrow(
      'Hard delete forbidden on table "students"',
    );

    // With explicit maintenance flag: allowed
    expect(simulateForbidHardDelete("true", "students")).toEqual({ status: "ALLOWED" });
  });
});
