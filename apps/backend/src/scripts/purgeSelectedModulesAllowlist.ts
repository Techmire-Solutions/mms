/**
 * Explicit allowlist for selective multi-tenant module hard purge.
 * Children before parents. Never include contacts/finance/accounting/users.
 */

export const PURGE_SELF_FK_NULLS: ReadonlyArray<{
  table: string;
  column: string;
}> = [
  { table: "faculty_departments", column: "parent_id" },
  { table: "tasks", column: "parent_task_id" },
];

/** Delete order: dependents first. */
export const PURGE_MODULE_TABLES: readonly string[] = [
  // tasks
  "task_assignees",
  "tasks",
  "task_module_preferences",
  // messaging
  "message_logs",
  "message_templates",
  "email_integrations",
  "sms_integrations",
  // examinations + question bank
  "assessment_answers",
  "assessment_results",
  "test_section_questions",
  "test_sections",
  "test_questions",
  "tests",
  "exam_results",
  "exam_classes",
  "exams",
  "question_options",
  "question_tags",
  "question_citations",
  "questions",
  "question_categories",
  "examinations_field_configs",
  "examinations_module_preferences",
  "question_bank_field_configs",
  "question_bank_module_preferences",
  // hasanat
  "hasanat_redemptions",
  "hasanat_distributions",
  "hasanat_batches",
  "hasanat_denoms",
  "hasanat_field_configs",
  "hasanat_module_preferences",
  // attendance
  "attendance",
  "attendance_leaves",
  "attendance_lookups",
  "attendance_field_configs",
  "attendance_module_preferences",
  // enrollments
  "enrollment_timeline_events",
  "enrollments",
  "enrollment_field_configs",
  "enrollment_module_preferences",
  // sessions
  "session_class_timetable_periods",
  "session_class_timetables",
  "session_class_fees",
  "session_class_schedules",
  "session_class_budgets",
  "session_class_discounts",
  "session_class_refreshments",
  "session_class_scholarships",
  "scholarship_eligibilities",
  "session_faculty",
  "session_classes",
  "sessions",
  "session_lookups",
  "session_field_configs",
  "session_module_preferences",
  // students
  "student_enrolled_sessions_legacy",
  "student_enrolled_sessions",
  "students",
  "student_lookups",
  "student_field_configs",
  "student_module_preferences",
  "student_sequence_config",
  // obligations
  "obligation_collections",
  "obligation_distributions",
  "wakala_types",
  "mujtahid_reps",
  "mujtahids",
  "obligation_types",
  // organization (before faculty setup catalogs they FK)
  // faculty
  "faculty_designation_roles",
  "faculty_assignments",
  "faculty",
  "faculty_designations",
  "faculty_departments",
  "faculty_lookups",
  "faculty_field_configs",
  "faculty_module_preferences",
  "faculty_setup_config",
] as const;

export { PURGE_DOCUMENT_STORE_SUFFIXES } from "./purgeSelectedModulesDocStore.js";

const BLACKLIST_EXACT = new Set([
  "tenant_users",
  "workspaces",
  "contacts",
  "contact_phones",
  "contact_emails",
  "contact_addresses",
  "contact_bank_details",
  "contact_relationships",
  "contact_relationship_contacts",
]);

const BLACKLIST_PREFIXES = ["finance_", "accounting_", "platform_", "audit_", "outbox"] as const;

export function isBlacklistedTable(table: string): boolean {
  const name = table.toLowerCase();
  if (BLACKLIST_EXACT.has(name)) return true;
  if (name.startsWith("contact")) return true;
  return BLACKLIST_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** Throws if allowlist intersects the hard blacklist. */
export function assertPurgeAllowlistSafe(tables: readonly string[] = PURGE_MODULE_TABLES): void {
  const blocked = tables.filter((table) => isBlacklistedTable(table));
  if (blocked.length > 0) {
    throw new Error(`Purge allowlist contains blacklisted tables: ${blocked.join(", ")}`);
  }
}

export function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(ident)) {
    throw new Error(`Unsafe SQL identifier: ${ident}`);
  }
  return `"${ident.replaceAll('"', '""')}"`;
}
