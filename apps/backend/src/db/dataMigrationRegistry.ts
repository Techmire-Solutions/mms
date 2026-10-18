export const dataMigrationsToRun = [
  {
    id: "001",
    load: async () =>
      (await import("./migrations/001_migrate_notification_settings.js")).runMigration001,
  },
  {
    id: "002",
    load: async () =>
      (await import("./migrations/002_migrate_global_settings_fields.js")).runMigration002,
  },
  {
    id: "003",
    load: async () => (await import("./migrations/003_migrate_multi_tenant.js")).runMigration003,
  },
  {
    id: "004",
    load: async () => (await import("./migrations/004_seed_demo_teachers.js")).runMigration004,
  },
  {
    id: "005",
    load: async () =>
      (await import("./migrations/005_normalize_teacher_contacts.js")).runMigration005,
  },
  {
    id: "006",
    load: async () =>
      (await import("./migrations/006_normalize_contact_linked_collections.js")).runMigration006,
  },
  {
    id: "007",
    load: async () =>
      (await import("./migrations/007_normalize_actor_user_links.js")).runMigration007,
  },
  {
    id: "008",
    load: async () => (await import("./migrations/008_backfill_login_email.js")).runMigration008,
  },
  {
    id: "009",
    load: async () => (await import("./migrations/009_seed_demo_students.js")).runMigration009,
  },
  {
    id: "010",
    load: async () =>
      (await import("./migrations/010_seed_demo_teacher_contacts.js")).runMigration010,
  },
  {
    id: "011",
    load: async () => (await import("./migrations/011_expand_demo_roster.js")).runMigration011,
  },
  {
    id: "012",
    load: async () => (await import("./migrations/012_migrate_users_to_tables.js")).runMigration012,
  },
  {
    id: "013",
    load: async () => (await import("./migrations/013_seed_contact_config.js")).runMigration013,
  },
  {
    id: "014",
    load: async () => (await import("./migrations/014_seed_student_config.js")).runMigration014,
  },
  {
    id: "015",
    load: async () => (await import("./migrations/015_seed_teacher_config.js")).runMigration015,
  },
  {
    id: "016",
    load: async () => (await import("./migrations/016_seed_session_config.js")).runMigration016,
  },
  {
    id: "017",
    load: async () => (await import("./migrations/017_seed_attendance_config.js")).runMigration017,
  },
  {
    id: "018",
    load: async () =>
      (await import("./migrations/018_seed_overdue_obligations.js")).runMigration018,
  },
  {
    id: "019",
    load: async () => (await import("./migrations/019_seed_question_bank.js")).runMigration019,
  },
  {
    id: "020",
    load: async () =>
      (await import("./migrations/020_migrate_contacts_to_tables.js")).runMigration020,
  },
  {
    id: "021",
    load: async () => (await import("./migrations/021_migrate_custom_tabs.js")).runMigration021,
  },
  {
    id: "022",
    load: async () =>
      (await import("./migrations/022_migrate_students_to_tables.js")).runMigration022,
  },
  {
    id: "023",
    load: async () =>
      (await import("./migrations/023_migrate_teachers_to_tables.js")).runMigration023,
  },
  {
    id: "024",
    load: async () =>
      (await import("./migrations/024_migrate_sessions_to_tables.js")).runMigration024,
  },
  {
    id: "025",
    load: async () =>
      (await import("./migrations/025_migrate_attendance_to_tables.js")).runMigration025,
  },
  {
    id: "026",
    load: async () =>
      (await import("./migrations/026_migrate_enrollments_to_tables.js")).runMigration026,
  },
  {
    id: "027",
    load: async () =>
      (await import("./migrations/027_migrate_obligations_to_tables.js")).runMigration027,
  },
  {
    id: "028",
    load: async () =>
      (await import("./migrations/028_migrate_finance_to_tables.js")).runMigration028,
  },
  {
    id: "029",
    load: async () =>
      (await import("./migrations/029_migrate_examinations_to_tables.js")).runMigration029,
  },
  {
    id: "030",
    load: async () =>
      (await import("./migrations/030_migrate_hasanat_to_tables.js")).runMigration030,
  },
  {
    id: "031",
    load: async () =>
      (await import("./migrations/031_migrate_accounting_to_tables.js")).runMigration031,
  },
  {
    id: "032",
    load: async () =>
      (await import("./migrations/032_migrate_question_bank_to_tables.js")).runMigration032,
  },
  {
    id: "033",
    load: async () => (await import("./migrations/033_migrate_logs_to_tables.js")).runMigration033,
  },
  {
    id: "034",
    load: async () =>
      (await import("./migrations/034_purge_overdue_obligations.js")).runMigration034,
  },
  {
    id: "035",
    load: async () =>
      (await import("./migrations/035_migrate_messaging_to_tables.js")).runMigration035,
  },
  {
    id: "036",
    load: async () =>
      (await import("./migrations/036_migrate_contacts_secrets_and_reports.js")).runMigration036,
  },
  {
    id: "037",
    load: async () =>
      (await import("./migrations/037_migrate_emergency_to_relationship.js")).runMigration037,
  },
  {
    id: "038",
    load: async () =>
      (await import("./migrations/038_clear_legacy_contacts_collections.js")).runMigration038,
  },
  {
    id: "039",
    load: async () =>
      (await import("./migrations/039_curate_contact_country_codes.js")).runMigration039,
  },
  {
    id: "053",
    load: async () =>
      (await import("./migrations/053_strip_teacher_contact_profile_fields.js")).runMigration053,
  },
  {
    id: "054",
    load: async () => (await import("./migrations/054_migrate_teacher_lookups.js")).runMigration054,
  },
  {
    id: "055",
    load: async () =>
      (await import("./migrations/055_clear_legacy_teacher_lookup_collections.js")).runMigration055,
  },
  {
    id: "060",
    load: async () =>
      (await import("./migrations/060_migrate_hasanat_setup_config.js")).runMigration060,
  },
  {
    id: "061",
    load: async () =>
      (await import("./migrations/061_clear_legacy_hasanat_setup_objects.js")).runMigration061,
  },
  {
    id: "062",
    load: async () =>
      (await import("./migrations/062_migrate_attendance_setup_config.js")).runMigration062,
  },
  {
    id: "063",
    load: async () =>
      (await import("./migrations/063_clear_legacy_attendance_setup_objects.js")).runMigration063,
  },
  {
    id: "064",
    load: async () =>
      (await import("./migrations/064_migrate_accounting_setup_config.js")).runMigration064,
  },
  {
    id: "065",
    load: async () =>
      (await import("./migrations/065_clear_legacy_accounting_setup_objects.js")).runMigration065,
  },
  {
    id: "066",
    load: async () =>
      (await import("./migrations/066_migrate_examinations_setup_config.js")).runMigration066,
  },
  {
    id: "067",
    load: async () =>
      (await import("./migrations/067_clear_legacy_examinations_setup_objects.js")).runMigration067,
  },
  {
    id: "068",
    load: async () => (await import("./migrations/068_migrate_session_lookups.js")).runMigration068,
  },
  {
    id: "069",
    load: async () =>
      (await import("./migrations/069_clear_legacy_session_lookup_collections.js")).runMigration069,
  },
  {
    id: "070",
    load: async () =>
      (await import("./migrations/070_migrate_attendance_lookups.js")).runMigration070,
  },
  {
    id: "071",
    load: async () =>
      (await import("./migrations/071_clear_legacy_attendance_lookup_collections.js"))
        .runMigration071,
  },
  {
    id: "072",
    load: async () =>
      (await import("./migrations/072_migrate_question_bank_setup_config.js")).runMigration072,
  },
  {
    id: "073",
    load: async () =>
      (await import("./migrations/073_clear_legacy_question_bank_setup_objects.js"))
        .runMigration073,
  },
  {
    id: "078",
    load: async () =>
      (await import("./migrations/078_migrate_branding_to_workspace_columns.js")).runMigration078,
  },
  {
    id: "079",
    load: async () =>
      (await import("./migrations/079_clear_legacy_branding_objects.js")).runMigration079,
  },
  {
    id: "080",
    load: async () =>
      (await import("./migrations/080_migrate_global_settings_to_workspace_columns.js"))
        .runMigration080,
  },
  {
    id: "081",
    load: async () =>
      (await import("./migrations/081_clear_legacy_global_settings_objects.js")).runMigration081,
  },
  {
    id: "082",
    load: async () =>
      (await import("./migrations/082_migrate_email_integration_to_table.js")).runMigration082,
  },
  {
    id: "083",
    load: async () =>
      (await import("./migrations/083_clear_legacy_email_integration_objects.js")).runMigration083,
  },
  {
    id: "084",
    load: async () =>
      (await import("./migrations/084_sync_platform_superuser_to_tenants.js")).runMigration084,
  },
  {
    id: "085",
    load: async () =>
      (await import("./migrations/085_grant_obligations_to_existing_workspaces.js"))
        .runMigration085,
  },
  {
    id: "086",
    load: async () =>
      (await import("./migrations/086_backfill_system_modules_access.js")).runMigration086,
  },
  {
    id: "087",
    load: async () =>
      (await import("./migrations/087_backfill_faculty_assignments.js")).runMigration087,
  },
  {
    id: "088",
    load: async () =>
      (await import("./migrations/088_migrate_organization_blueprints.js")).runMigration088,
  },
  {
    id: "089",
    load: async () =>
      (await import("./migrations/089_gapfill_fda_to_faculty_assignments.js")).runMigration089,
  },
  {
    id: "090",
    load: async () =>
      (await import("./migrations/090_encrypt_workspace_llm_secrets.js")).runMigration090,
  },
];
