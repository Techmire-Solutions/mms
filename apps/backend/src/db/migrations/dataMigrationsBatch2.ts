import type { DataMigrationEntry } from "./dataMigrationsBatch1.js";

export const dataMigrationsBatch2: DataMigrationEntry[] = [
  {
    id: "053",
    load: async () =>
      (await import("./053_strip_teacher_contact_profile_fields.js")).runMigration053,
  },
  {
    id: "054",
    load: async () => (await import("./054_migrate_teacher_lookups.js")).runMigration054,
  },
  {
    id: "055",
    load: async () =>
      (await import("./055_clear_legacy_teacher_lookup_collections.js")).runMigration055,
  },
  {
    id: "060",
    load: async () => (await import("./060_migrate_hasanat_setup_config.js")).runMigration060,
  },
  {
    id: "061",
    load: async () => (await import("./061_clear_legacy_hasanat_setup_objects.js")).runMigration061,
  },
  {
    id: "062",
    load: async () => (await import("./062_migrate_attendance_setup_config.js")).runMigration062,
  },
  {
    id: "063",
    load: async () =>
      (await import("./063_clear_legacy_attendance_setup_objects.js")).runMigration063,
  },
  {
    id: "064",
    load: async () => (await import("./064_migrate_accounting_setup_config.js")).runMigration064,
  },
  {
    id: "065",
    load: async () =>
      (await import("./065_clear_legacy_accounting_setup_objects.js")).runMigration065,
  },
  {
    id: "066",
    load: async () => (await import("./066_migrate_examinations_setup_config.js")).runMigration066,
  },
  {
    id: "067",
    load: async () =>
      (await import("./067_clear_legacy_examinations_setup_objects.js")).runMigration067,
  },
  {
    id: "068",
    load: async () => (await import("./068_migrate_session_lookups.js")).runMigration068,
  },
  {
    id: "069",
    load: async () =>
      (await import("./069_clear_legacy_session_lookup_collections.js")).runMigration069,
  },
  {
    id: "070",
    load: async () => (await import("./070_migrate_attendance_lookups.js")).runMigration070,
  },
  {
    id: "071",
    load: async () =>
      (await import("./071_clear_legacy_attendance_lookup_collections.js")).runMigration071,
  },
  {
    id: "072",
    load: async () => (await import("./072_migrate_question_bank_setup_config.js")).runMigration072,
  },
  {
    id: "073",
    load: async () =>
      (await import("./073_clear_legacy_question_bank_setup_objects.js")).runMigration073,
  },
  {
    id: "078",
    load: async () =>
      (await import("./078_migrate_branding_to_workspace_columns.js")).runMigration078,
  },
  {
    id: "079",
    load: async () => (await import("./079_clear_legacy_branding_objects.js")).runMigration079,
  },
  {
    id: "080",
    load: async () =>
      (await import("./080_migrate_global_settings_to_workspace_columns.js")).runMigration080,
  },
  {
    id: "081",
    load: async () =>
      (await import("./081_clear_legacy_global_settings_objects.js")).runMigration081,
  },
  {
    id: "082",
    load: async () => (await import("./082_migrate_email_integration_to_table.js")).runMigration082,
  },
  {
    id: "083",
    load: async () =>
      (await import("./083_clear_legacy_email_integration_objects.js")).runMigration083,
  },
  {
    id: "084",
    load: async () => (await import("./084_sync_platform_superuser_to_tenants.js")).runMigration084,
  },
  {
    id: "085",
    load: async () =>
      (await import("./085_grant_obligations_to_existing_workspaces.js")).runMigration085,
  },
  {
    id: "086",
    load: async () => (await import("./086_backfill_system_modules_access.js")).runMigration086,
  },
  {
    id: "087",
    load: async () => (await import("./087_backfill_faculty_assignments.js")).runMigration087,
  },
  {
    id: "088",
    load: async () => (await import("./088_migrate_organization_blueprints.js")).runMigration088,
  },
  {
    id: "089",
    load: async () => (await import("./089_gapfill_fda_to_faculty_assignments.js")).runMigration089,
  },
  {
    id: "090",
    load: async () => (await import("./090_encrypt_workspace_llm_secrets.js")).runMigration090,
  },
  {
    id: "091",
    load: async () => (await import("./091_backfill_functional_currency.js")).runMigration091,
  },
];
