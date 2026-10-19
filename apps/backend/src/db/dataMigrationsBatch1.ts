export interface DataMigrationEntry {
  id: string;
  load: () => Promise<(tx?: unknown) => Promise<unknown>>;
}

export const dataMigrationsBatch1: DataMigrationEntry[] = [
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
];
