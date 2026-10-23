import {
  ACCOUNTING_MODULE_MANIFEST,
  ATTENDANCE_MODULE_MANIFEST,
  CONTACTS_MODULE_MANIFEST,
  DASHBOARD_PREFERENCES_KEY,
  EMAIL_INTEGRATION_OBJECT_KEY,
  ENROLLMENTS_MODULE_MANIFEST,
  EXAMINATIONS_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  HASANAT_MODULE_MANIFEST,
  INVOICE_TEMPLATE_OBJECT_KEY,
  MESSAGING_MODULE_MANIFEST,
  OBLIGATIONS_MODULE_MANIFEST,
  QUESTION_BANK_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
  STUDENT_CARD_TEMPLATE_OBJECT_KEY,
  STUDENTS_MODULE_MANIFEST,
  FACULTY_MODULE_MANIFEST,
  USERS_MODULE_MANIFEST,
  TASKS_MODULE_MANIFEST,
  type Permission,
} from "@mms/shared";
export const WRITE_ROLES = new Set([
  "admin",
  "accountant",
  "faculty",
  "teacher",
  "assistant_teacher",
]);

/**
 * Allowed object keys that intentionally ride the staff write-role set instead of a
 * single permission (frontend-persisted dashboard / template / widget configuration
 * that staff own). Every other key in `ALLOWED_OBJECTS` MUST be mapped in
 * `OBJECT_READ_PERMISSION` / `OBJECT_WRITE_PERMISSION`; an allowed key that is neither
 * mapped nor listed here is denied (fail closed), so adding a new allowed key can no
 * longer silently widen access to staff roles. `rbacPermissionMapCoverage.test.ts`
 * enforces this completeness.
 */
export const STAFF_WRITE_OBJECT_KEYS: ReadonlySet<string> = new Set([
  DASHBOARD_PREFERENCES_KEY,
  INVOICE_TEMPLATE_OBJECT_KEY,
  STUDENT_CARD_TEMPLATE_OBJECT_KEY,
  "kpi_custom_widgets",
  "mms_dashboard_disabled_cards",
  "dashboard_section_settings",
  "report_custom_visuals",
]);

/** Dynamic per-user widget object-key prefixes that likewise use the staff write-role set. */
const STAFF_WRITE_OBJECT_KEY_PREFIXES = [
  "kpi_config_",
  "prev_kpi_titles_",
  "prev_kpi_ids_",
  "kpi_custom_cards_",
] as const;

export function isStaffWriteObjectKey(key: string): boolean {
  return (
    STAFF_WRITE_OBJECT_KEYS.has(key) ||
    STAFF_WRITE_OBJECT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

/** Allowed collections that intentionally ride the staff write-role set (no dedicated permission). */
export const STAFF_WRITE_COLLECTION_KEYS: ReadonlySet<string> = new Set(["currencies"]);

export const COLLECTION_READ_PERMISSION: Record<string, Permission> = {
  tasks: TASKS_MODULE_MANIFEST.permissions.read,
  contacts: CONTACTS_MODULE_MANIFEST.permissions.read,
  students: STUDENTS_MODULE_MANIFEST.permissions.read,
  faculty: FACULTY_MODULE_MANIFEST.permissions.read,
  sessions: SESSIONS_MODULE_MANIFEST.permissions.read,
  enrollments: ENROLLMENTS_MODULE_MANIFEST.permissions.read,
  attendance: ATTENDANCE_MODULE_MANIFEST.permissions.read,
  attendance_records: ATTENDANCE_MODULE_MANIFEST.permissions.read,
  finance_invoices: FINANCE_MODULE_MANIFEST.permissions.read,
  finance_payments: FINANCE_MODULE_MANIFEST.permissions.read,
  obligation_collections: OBLIGATIONS_MODULE_MANIFEST.permissions.read,
  obligation_types: OBLIGATIONS_MODULE_MANIFEST.permissions.read,
  mujtahids: OBLIGATIONS_MODULE_MANIFEST.permissions.read,
  mujtahid_reps: OBLIGATIONS_MODULE_MANIFEST.permissions.read,
  wakala_types: OBLIGATIONS_MODULE_MANIFEST.permissions.read,
  obligation_distributions: OBLIGATIONS_MODULE_MANIFEST.permissions.read,
  accounting_entries: ACCOUNTING_MODULE_MANIFEST.permissions.read,
  accounting_accounts: ACCOUNTING_MODULE_MANIFEST.permissions.read,
  accounts: ACCOUNTING_MODULE_MANIFEST.permissions.read,
  accounting_fiscal_years: ACCOUNTING_MODULE_MANIFEST.permissions.read,
  fiscal_years: ACCOUNTING_MODULE_MANIFEST.permissions.read,
  hasanat_distributions: HASANAT_MODULE_MANIFEST.permissions.read,
  hasanat_batches: HASANAT_MODULE_MANIFEST.permissions.read,
  hasanat_denoms: HASANAT_MODULE_MANIFEST.permissions.read,
  hasanat_redemptions: HASANAT_MODULE_MANIFEST.permissions.read,
  exams: EXAMINATIONS_MODULE_MANIFEST.permissions.read,
  exam_results: EXAMINATIONS_MODULE_MANIFEST.permissions.read,
  questions: QUESTION_BANK_MODULE_MANIFEST.permissions.read,
  tests: QUESTION_BANK_MODULE_MANIFEST.permissions.read,
  assessment_results: QUESTION_BANK_MODULE_MANIFEST.permissions.read,
  users: USERS_MODULE_MANIFEST.permissions.read,
  user_activity_logs: "analytics.view",
  message_templates: MESSAGING_MODULE_MANIFEST.permissions.read,
  message_logs: MESSAGING_MODULE_MANIFEST.permissions.read,
  backups: "settings.global.write",
};

export const COLLECTION_WRITE_PERMISSION: Record<string, Permission> = {
  tasks: TASKS_MODULE_MANIFEST.permissions.write,
  contacts: CONTACTS_MODULE_MANIFEST.permissions.write,
  students: STUDENTS_MODULE_MANIFEST.permissions.write,
  faculty: FACULTY_MODULE_MANIFEST.permissions.write,
  sessions: SESSIONS_MODULE_MANIFEST.permissions.write,
  enrollments: ENROLLMENTS_MODULE_MANIFEST.permissions.write,
  attendance: ATTENDANCE_MODULE_MANIFEST.permissions.write,
  attendance_records: ATTENDANCE_MODULE_MANIFEST.permissions.write,
  finance_invoices: FINANCE_MODULE_MANIFEST.permissions.write,
  finance_payments: FINANCE_MODULE_MANIFEST.permissions.write,
  obligation_collections: OBLIGATIONS_MODULE_MANIFEST.permissions.write,
  obligation_types: OBLIGATIONS_MODULE_MANIFEST.permissions.write,
  mujtahids: OBLIGATIONS_MODULE_MANIFEST.permissions.write,
  mujtahid_reps: OBLIGATIONS_MODULE_MANIFEST.permissions.write,
  wakala_types: OBLIGATIONS_MODULE_MANIFEST.permissions.write,
  obligation_distributions: OBLIGATIONS_MODULE_MANIFEST.permissions.write,
  accounting_entries: ACCOUNTING_MODULE_MANIFEST.permissions.write,
  accounting_accounts: ACCOUNTING_MODULE_MANIFEST.permissions.write,
  accounts: ACCOUNTING_MODULE_MANIFEST.permissions.write,
  accounting_fiscal_years: ACCOUNTING_MODULE_MANIFEST.permissions.write,
  fiscal_years: ACCOUNTING_MODULE_MANIFEST.permissions.write,
  hasanat_distributions: HASANAT_MODULE_MANIFEST.permissions.write,
  hasanat_batches: HASANAT_MODULE_MANIFEST.permissions.write,
  hasanat_denoms: HASANAT_MODULE_MANIFEST.permissions.write,
  hasanat_redemptions: HASANAT_MODULE_MANIFEST.permissions.write,
  exams: EXAMINATIONS_MODULE_MANIFEST.permissions.write,
  exam_results: EXAMINATIONS_MODULE_MANIFEST.permissions.write,
  questions: QUESTION_BANK_MODULE_MANIFEST.permissions.write,
  tests: QUESTION_BANK_MODULE_MANIFEST.permissions.write,
  assessment_results: QUESTION_BANK_MODULE_MANIFEST.permissions.write,
  users: USERS_MODULE_MANIFEST.permissions.write,
  user_activity_logs: "analytics.view",
  message_templates: MESSAGING_MODULE_MANIFEST.permissions.write,
  message_logs: MESSAGING_MODULE_MANIFEST.permissions.write,
  backups: "settings.global.write",
};

/** Distinct delete permission when the module manifest defines one; else write. */
export const COLLECTION_DELETE_PERMISSION: Record<string, Permission> = {
  tasks: TASKS_MODULE_MANIFEST.permissions.delete,
  contacts: CONTACTS_MODULE_MANIFEST.permissions.delete,
  students: STUDENTS_MODULE_MANIFEST.permissions.delete,
  faculty: FACULTY_MODULE_MANIFEST.permissions.delete,
  attendance: ATTENDANCE_MODULE_MANIFEST.permissions.delete,
  attendance_records: ATTENDANCE_MODULE_MANIFEST.permissions.delete,
  obligation_collections: OBLIGATIONS_MODULE_MANIFEST.permissions.delete,
};

// `global_settings`/`branding` keep entries here even though `dbObjectRoutes.ts` no
// longer uses them as the outer read/write gate (any authenticated tenant user can
// call those two keys now) — `canWriteObject(user, 'global_settings' | 'branding')`
// is still called there to decide per-field visibility, and relies on these entries
// resolving to `roleHasPermission(role, 'settings.global.write' | 'settings.branding.write')`
// rather than falling through to `canWriteObject`'s unrelated `WRITE_ROLES` default.
export const OBJECT_READ_PERMISSION: Record<string, Permission> = {
  global_settings: "configuration.view",
  // Legacy objects key for module grants (now workspaces.granted_modules). Apex SQL
  // table platform_settings is TLS-only and is not served via /api/db objects.
  platform_settings: "configuration.view",
  branding: "configuration.view",
  [EMAIL_INTEGRATION_OBJECT_KEY]: "settings.global.write",
  sms_integration: "settings.global.write",
  whatsapp_integration: "settings.global.write",
};

export const OBJECT_WRITE_PERMISSION: Record<string, Permission> = {
  global_settings: "settings.global.write",
  branding: "settings.branding.write",
  [EMAIL_INTEGRATION_OBJECT_KEY]: "settings.global.write",
  sms_integration: "settings.global.write",
  whatsapp_integration: "settings.global.write",
};

export const ALLOWED_COLLECTIONS = new Set(["currencies", "backups"]);

export const ALLOWED_OBJECTS = new Set([
  "global_settings",
  "platform_settings",
  "branding",
  EMAIL_INTEGRATION_OBJECT_KEY,
  "sms_integration",
  "whatsapp_integration",
  DASHBOARD_PREFERENCES_KEY,
  INVOICE_TEMPLATE_OBJECT_KEY,
  STUDENT_CARD_TEMPLATE_OBJECT_KEY,
  "kpi_custom_widgets",
  "mms_dashboard_disabled_cards",
  "dashboard_section_settings",
  "report_custom_visuals",
]);

export function isAllowedCollectionName(collectionName: string): boolean {
  return ALLOWED_COLLECTIONS.has(collectionName);
}

export function isAllowedObjectKey(key: string): boolean {
  return (
    ALLOWED_OBJECTS.has(key) ||
    key.startsWith("kpi_config_") ||
    key.startsWith("prev_kpi_titles_") ||
    key.startsWith("prev_kpi_ids_") ||
    key.startsWith("kpi_custom_cards_")
  );
}
