import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const drizzleDir = join(process.cwd(), "src/db/migrations_drizzle");

describe("students deferred DB migrations (source)", () => {
  it("0016 adds gender expression index (historical; dropped by 0020)", () => {
    const sql = readFileSync(join(drizzleDir, "0016_students_gender_active_idx.sql"), "utf8");
    expect(sql).toContain("students_workspace_gender_active_idx");
    expect(sql).toContain("custom_data->>'gender'");
  });

  it("0017 promotes status/gr_number and rebuilds indexes on typed columns", () => {
    const sql = readFileSync(join(drizzleDir, "0017_students_status_gr_columns.sql"), "utf8");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "status"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "gr_number"');
    expect(sql).toContain("students_workspace_gr_active_uidx");
    expect(sql).toContain('lower(trim("gr_number"))');
  });

  it("0018 creates FORCE RLS student_lookups", () => {
    const sql = readFileSync(join(drizzleDir, "0018_student_lookups.sql"), "utf8");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "student_lookups"');
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  });

  it("0019 nulls orphan contact_id then adds composite FK SET NULL", () => {
    const sql = readFileSync(join(drizzleDir, "0019_students_contact_fk.sql"), "utf8");
    expect(sql).toContain('SET "contact_id" = NULL');
    expect(sql).toContain(
      "students_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk",
    );
    expect(sql).toContain("ON DELETE set null");
  });

  it("0163 upgrades contact_id to partial unique index, adds session FK, and prunes redundant expression indexes", () => {
    const sql = readFileSync(join(drizzleDir, "0163_students_constraints_hardening.sql"), "utf8");
    expect(sql).toContain("students_workspace_contact_active_uidx");
    expect(sql).toContain("student_enrolled_sessions_session_fk");
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "students_workspace_status_expr_updated_at_active_idx"',
    );
    expect(sql).toContain('DROP INDEX IF EXISTS "students_workspace_status_expr_id_active_idx"');
    expect(sql).toContain('DROP INDEX IF EXISTS "students_workspace_active_idx"');
    expect(sql).toContain('DROP INDEX IF EXISTS "students_workspace_deleted_idx"');
    expect(sql).toContain('DROP INDEX IF EXISTS "student_lookups_workspace_kind_idx"');
    expect(sql).toContain('lower(btrim("gr_number"))');
    expect(sql).toContain('lower(btrim("student_id"))');
    expect(sql).toContain("ON DELETE restrict");
  });

  it("0164 prunes redundant session prefix index, adds date checks, and creates student_sequence_config", () => {
    const sql = readFileSync(join(drizzleDir, "0164_students_optimizations.sql"), "utf8");
    expect(sql).toContain('DROP INDEX IF EXISTS "student_enrolled_sessions_workspace_student_idx"');
    expect(sql).toContain("students_registered_date_iso_check");
    expect(sql).toContain("students_enrollment_date_iso_check");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "student_sequence_config"');
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  });
});

describe("students sync integrity (source)", () => {
  it("migrate-GR wraps saveStudent with unique conflict mapping", () => {
    const src = readFileSync(
      join(process.cwd(), "src/students/use-cases/studentOperationUseCases.ts"),
      "utf8",
    );
    expect(src).toMatch(/migrateStudentsMissingGrNumbers[\s\S]*throwGrUniqueConflict/);
  });

  it("list status/GR expressions use typed columns only", () => {
    const src = readFileSync(
      join(process.cwd(), "src/db/repositories/studentRepositoryListQuery.ts"),
      "utf8",
    );
    expect(src).toContain("COALESCE(${students.status}, 'active')");
    expect(src).toContain("COALESCE(${students.grNumber}, '')");
    expect(src).not.toContain("customData}->>'status'");
    expect(src).not.toMatch(/grNumberExpr[\s\S]*customData}->>'grNumber'/);
  });

  it("0020 drops obsolete student JSONB gender expression index", () => {
    const sql = readFileSync(join(drizzleDir, "0020_drop_students_gender_active_idx.sql"), "utf8");
    expect(sql).toContain('DROP INDEX IF EXISTS "students_workspace_gender_active_idx"');
  });
});
