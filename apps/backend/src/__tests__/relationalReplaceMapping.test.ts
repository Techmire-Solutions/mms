import { describe, expect, it } from "vitest";
import {
  listBackupSnapshotCollectionKeys,
  RELATIONAL_REPLACE_MAPPING,
  sortCollectionNamesForRestore,
  withCompleteRelationalRestoreCollections,
} from "../db/relationalReplaceMapping.js";

describe("RELATIONAL_REPLACE_MAPPING backup coverage", () => {
  it("snapshots every REST-migrated business table except the audit trail", () => {
    const snapshotKeys = Object.entries(RELATIONAL_REPLACE_MAPPING)
      .filter(([, mapping]) => Boolean(mapping.snapshotFnName))
      .map(([key]) => key)
      .sort();

    expect(snapshotKeys).toEqual([
      "accounting_accounts",
      "accounting_entries",
      "accounting_field_configs",
      "accounting_fiscal_years",
      "accounting_module_preferences",
      "assessment_results",
      "attendance_field_configs",
      "attendance_lookups",
      "attendance_module_preferences",
      "attendance_records",
      "contact_field_configs",
      "contact_lookups",
      "contact_module_preferences",
      "contacts",
      "dashboard_preferences",
      "dashboard_widgets",
      "enrollment_field_configs",
      "enrollment_module_preferences",
      "enrollments",
      "exam_results",
      "examinations_field_configs",
      "examinations_module_preferences",
      "exams",
      "faculty",
      "faculty_field_configs",
      "faculty_lookups",
      "faculty_module_preferences",
      "finance_field_configs",
      "finance_invoices",
      "finance_module_preferences",
      "finance_payments",
      "hasanat_batches",
      "hasanat_denoms",
      "hasanat_distributions",
      "hasanat_field_configs",
      "hasanat_module_preferences",
      "hasanat_redemptions",
      "message_logs",
      "message_templates",
      "mujtahid_reps",
      "mujtahids",
      "obligation_collections",
      "obligation_distributions",
      "obligation_types",
      "question_bank_field_configs",
      "question_bank_module_preferences",
      "questions",
      "saved_reports",
      "session_field_configs",
      "session_lookups",
      "session_module_preferences",
      "sessions",
      "student_field_configs",
      "student_lookups",
      "student_module_preferences",
      "students",
      "tests",
      "user_activity_logs",
      "user_field_configs",
      "user_module_preferences",
      "user_ui_preferences",
      "users",
      "wakala_types",
    ]);
  });

  it("never snapshots or replaces the audit trail (restore must not roll it back)", () => {
    expect(RELATIONAL_REPLACE_MAPPING.audit_log).toBeUndefined();
  });

  it("restores contacts before users to preserve contact_id foreign keys", () => {
    expect(
      sortCollectionNamesForRestore(["users", "students", "contacts", "message_logs"]),
    ).toEqual(["contacts", "students", "message_logs", "users"]);
  });

  it("expands missing snapshotted collections to [] when users mark a full restore", () => {
    const expanded = withCompleteRelationalRestoreCollections({
      users: [{ id: "u-1" }],
      contacts: [{ id: "c-1" }],
    });

    expect(expanded.users).toEqual([{ id: "u-1" }]);
    expect(expanded.contacts).toEqual([{ id: "c-1" }]);
    expect(expanded.students).toEqual([]);
    expect(expanded.message_logs).toEqual([]);
    expect(expanded.audit_log).toBeUndefined();
    expect(Object.keys(expanded).sort()).toEqual([...listBackupSnapshotCollectionKeys()].sort());
  });

  it("does not wipe relational tables for partial payloads without users", () => {
    const partial = withCompleteRelationalRestoreCollections({
      students: [{ id: "s-1" }],
    });
    expect(partial).toEqual({ students: [{ id: "s-1" }] });
  });

  it("covers every tenant business table that belongs in a full workspace backup", () => {
    // Keep this list in sync with apps/backend/src/db/schema.ts tenant tables.
    // Intentional non-backup tables: audit_trail_events, audit_verification_runs, audit_merkle_roots, crypto_shredding_keys, background_jobs,
    // contact_google_sync_credentials (OAuth secrets — never snapshot),
    // plus platform/global tables (workspaces, platform_*, auth_artifacts, data_migrations).
    const tenantBusinessTables = [
      "tenant_users",
      "contacts",
      "contact_field_configs",
      "contact_lookups",
      "contact_module_preferences",
      "student_lookups",
      "student_field_configs",
      "student_module_preferences",
      "students",
      "faculty",
      "sessions",
      "attendance",
      "enrollments",
      "obligation_types",
      "mujtahids",
      "mujtahid_reps",
      "wakala_types",
      "obligation_distributions",
      "obligation_collections",
      "finance_invoices",
      "finance_payments",
      "exams",
      "exam_results",
      "hasanat_denoms",
      "hasanat_batches",
      "hasanat_distributions",
      "hasanat_redemptions",
      "accounting_accounts",
      "accounting_entries",
      "accounting_fiscal_years",
      "questions",
      "tests",
      "assessment_results",
      "user_activity_logs",
      "saved_reports",
      "dashboard_preferences",
      "dashboard_widgets",
      "message_templates",
      "message_logs",
    ];

    const snapshotKeys = new Set(listBackupSnapshotCollectionKeys());
    const tableToLogicalKey: Record<string, string> = {
      tenant_users: "users",
      attendance: "attendance_records",
    };

    for (const table of tenantBusinessTables) {
      const logicalKey = tableToLogicalKey[table] ?? table;
      expect(snapshotKeys.has(logicalKey)).toBe(true);
    }
  });
});
