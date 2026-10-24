/**
 * Configuration and allowlists for resetAllModulesExceptContacts script.
 */

/** Self-referencing FK columns that must be set to NULL before deleting rows */
export const SELF_REFERENCING_FKS: ReadonlyArray<{ table: string; column: string }> = [
  { table: "faculty_departments", column: "parent_id" },
  { table: "tasks", column: "parent_task_id" },
];

/** Tables strictly protected from purge (NEVER delete) */
export const PROTECTED_TABLES = new Set([
  // Platform Console
  "workspaces",
  "platform_users",
  "platform_user_permissions",
  "platform_settings",
  "platform_activity_logs",
  // Contacts Module (Full Preservation)
  "contacts",
  "contact_phones",
  "contact_emails",
  "contact_addresses",
  "contact_tags",
  "contact_socials",
  "contact_educations",
  "contact_experiences",
  "contact_skills",
  "contact_relationships",
  "contact_activities",
  "contact_attachments",
  "contact_bank_details",
  "contact_lookups",
  "contact_field_configs",
  "contact_module_preferences",
  "contact_google_sync_credentials",
  // System / Auth
  "tenant_users",
  "data_migrations",
  "auth_artifacts",
  "collections",
  "objects",
  // Audit Trail ledger
  "audit_trail_events",
  "audit_trail_events_default",
  "audit_trail_events_y2026m09",
  "audit_trail_events_y2026m10",
  "audit_trail_events_y2026m11",
  "audit_trail_events_y2026m12",
  "audit_trail_events_y2027m01",
  "audit_trail_events_y2027m02",
  "audit_trail_events_y2027m03",
  "audit_trail_events_y2027m04",
  "audit_trail_events_y2027m05",
  "audit_trail_events_y2027m06",
  "audit_trail_events_y2027m07",
  "audit_trail_events_y2027m08",
  "audit_trail_events_y2027m09",
  "audit_verification_runs",
  "audit_merkle_roots",
  "crypto_shredding_keys",
  "audit_erasure_requests",
]);

/** Contact collections that should be preserved under t:{tenant}: */
export const PRESERVED_CONTACT_COLLECTIONS = new Set([
  "contacts",
  "addressLabels",
  "countryCodes",
  "currencies",
  "emailLabels",
  "genders",
  "phoneLabels",
  "relationships",
  "socialPlatforms",
]);

/** Contact objects that should be preserved under t:{tenant}: */
export const PRESERVED_CONTACT_OBJECTS = new Set([
  "contact_field_config",
  "contact_field_config_default",
  "contact_prefs",
  "socialPlaceholders",
  "branding",
  "global_settings",
]);

export function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(ident)) {
    throw new Error(`Unsafe SQL identifier: ${ident}`);
  }
  return `"${ident.replaceAll('"', '""')}"`;
}
