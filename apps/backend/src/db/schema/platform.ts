import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  boolean,
  varchar,
  bigint,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { PlatformRole, LlmConfig } from "@mms/shared";

/** Apex workspaces registry — not tenant-scoped. Branding fields migrated from objects store (migration 0071). */
export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    subdomain: text("subdomain").notNull().unique(),
    madrasaName: text("madrasa_name").notNull(),
    tagline: text("tagline"),
    country: text("country"),
    industryType: varchar("industry_type", { length: 50 }).default("madrasa"),
    appliedBlueprintKey: varchar("applied_blueprint_key", { length: 100 }),
    appliedBlueprintVersion: integer("applied_blueprint_version"),
    blueprintAppliedAt: timestamp("blueprint_applied_at", { withTimezone: true, mode: "date" }),
    enabled: boolean("enabled").notNull().default(true),
    // Branding — theme
    primaryColor: varchar("primary_color", { length: 20 }),
    secondaryColor: varchar("secondary_color", { length: 20 }),
    cornerStyle: varchar("corner_style", { length: 20 }),
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    footerText: varchar("footer_text", { length: 120 }),
    // Branding — institution identity
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 40 }),
    website: text("website"),
    legalName: varchar("legal_name", { length: 255 }),
    registrationNumber: varchar("registration_number", { length: 100 }),
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    region: varchar("region", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    socialLinks: jsonb("social_links").$type<{ platform: string; url: string }[]>(),
    // Global settings (migrated from objects store in migration 0072)
    language: varchar("language", { length: 10 }),
    timezone: varchar("timezone", { length: 50 }),
    dateFormat: varchar("date_format", { length: 20 }),
    emailNotifications: boolean("email_notifications"),
    smsNotifications: boolean("sms_notifications"),
    twoFactor: boolean("two_factor"),
    sessionTimeout: varchar("session_timeout", { length: 20 }),
    passwordPolicy: varchar("password_policy", { length: 20 }),
    theme: varchar("theme", { length: 20 }),
    enabledModules: jsonb("enabled_modules").$type<Record<string, boolean>>(),
    grantedModules: jsonb("granted_modules").$type<Record<string, boolean>>(),
    llmProvider: varchar("llm_provider", { length: 30 }),
    llmApiKey: text("llm_api_key"),
    llmConfigs: jsonb("llm_configs").$type<LlmConfig[]>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspaces_subdomain_idx").on(table.subdomain),
    index("workspaces_enabled_idx").on(table.enabled),
    index("workspaces_madrasa_name_idx").on(table.madrasaName),
  ],
);

/** Apex platform super-users — not tenant-scoped. */
export const platformUsers = pgTable(
  "platform_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** E.164 — only source of a real number for platform SMS 2FA; set by the admin themselves. */
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
    role: text("role").$type<PlatformRole>().notNull().default("admin"),
    sessionVersion: integer("session_version").notNull().default(0),
    disabledAt: timestamp("disabled_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_users_email_idx").on(table.email),
    uniqueIndex("platform_users_single_super_user_idx")
      .on(table.role)
      .where(sql`${table.role} = 'super_user'`),
    // CHECK enforced in SQL migrations (platform_users_role_check).
  ],
);

/** Normalized 3NF granular permission grants for platform admins. */
export const platformUserPermissions = pgTable(
  "platform_user_permissions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    platformUserId: text("platform_user_id")
      .notNull()
      .references(() => platformUsers.id, { onDelete: "cascade" }),
    permissionKey: varchar("permission_key", { length: 40 }).notNull(),
    isGranted: boolean("is_granted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_user_perms_user_key_uidx").on(table.platformUserId, table.permissionKey),
    index("platform_user_perms_user_idx").on(table.platformUserId),
    // CHECK enforced in SQL migrations (platform_user_perms_key_check):
    // permission_key IN ('workspaces','onboard','settings','admins','system').
  ],
);

/** Apex platform settings — single-row TLS/Certbot config (`id = 'global'`).
 * Not related to the legacy document-store object key `platform_settings`
 * (module grants now live on `workspaces.granted_modules`).
 * CHECK enforced in SQL migrations (platform_settings_global_id_check): id = 'global'. */
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("global"),
  syncTlsOnCreate: boolean("sync_tls_on_create").notNull().default(true),
  tlsExtraSans: text("tls_extra_sans").notNull().default(""),
  certbotEmail: text("certbot_email").notNull().default(""),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  smsNotifications: boolean("sms_notifications").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Platform-wide email provider config & credentials — singleton row, mirrors tenant `email_integrations`. */
export const platformEmailIntegrations = pgTable("platform_email_integrations", {
  id: text("id").primaryKey().default("global"),
  providerId: varchar("provider_id", { length: 40 }).notNull().default("gmail"),
  fromAddress: varchar("from_address", { length: 255 }).notNull().default(""),
  fromName: varchar("from_name", { length: 255 }).notNull().default("MMS Platform"),
  smtpUsername: varchar("smtp_username", { length: 255 }).notNull().default(""),
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure"),
  smtpPassword: text("smtp_password"),
  connected: boolean("connected").notNull().default(false),
  hasCredentials: boolean("has_credentials").notNull().default(false),
  lastTestAt: timestamp("last_test_at", { withTimezone: true, mode: "date" }),
  lastTestOk: boolean("last_test_ok"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Platform-wide SMS provider config & credentials — singleton row, mirrors tenant `sms_integrations`. */
export const platformSmsIntegrations = pgTable("platform_sms_integrations", {
  id: text("id").primaryKey().default("global"),
  providerId: varchar("provider_id", { length: 40 }).notNull().default("twilio"),
  accountId: varchar("account_id", { length: 255 }).notNull().default(""),
  senderId: varchar("sender_id", { length: 255 }).notNull().default(""),
  apiBaseUrl: varchar("api_base_url", { length: 255 }),
  accountSecret: text("account_secret"),
  connected: boolean("connected").notNull().default(false),
  hasCredentials: boolean("has_credentials").notNull().default(false),
  lastTestAt: timestamp("last_test_at", { withTimezone: true, mode: "date" }),
  lastTestOk: boolean("last_test_ok"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const platformActivityLogs = pgTable(
  "platform_activity_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** Nullable so deleting a platform user retains audit history (ON DELETE SET NULL). */
    userId: text("user_id").references(() => platformUsers.id, { onDelete: "set null" }),
    userEmail: text("user_email").notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    targetResource: varchar("target_resource", { length: 120 }),
    targetId: varchar("target_id", { length: 64 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    metadataMessage: varchar("metadata_message", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("platform_activity_logs_created_at_idx").on(table.createdAt),
    index("platform_activity_logs_action_created_at_idx").on(table.action, table.createdAt),
    index("platform_activity_logs_user_created_idx").on(table.userId, table.createdAt),
  ],
);

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type InsertWorkspaceRow = typeof workspaces.$inferInsert;
/** All branding-related columns projected from a workspace row. */
export type WorkspaceBrandingRow = Pick<
  WorkspaceRow,
  | "subdomain"
  | "madrasaName"
  | "tagline"
  | "country"
  | "primaryColor"
  | "secondaryColor"
  | "cornerStyle"
  | "logoUrl"
  | "faviconUrl"
  | "footerText"
  | "email"
  | "phone"
  | "website"
  | "legalName"
  | "registrationNumber"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "region"
  | "postalCode"
  | "socialLinks"
>;
/** All global-settings-related columns projected from a workspace row. */
export type WorkspaceGlobalSettingsRow = Pick<
  WorkspaceRow,
  | "subdomain"
  | "language"
  | "timezone"
  | "dateFormat"
  | "emailNotifications"
  | "smsNotifications"
  | "twoFactor"
  | "sessionTimeout"
  | "passwordPolicy"
  | "theme"
  | "enabledModules"
  | "grantedModules"
  | "llmProvider"
  | "llmApiKey"
  | "llmConfigs"
>;
export type PlatformUserRow = typeof platformUsers.$inferSelect;
export type InsertPlatformUserRow = typeof platformUsers.$inferInsert;
export type PlatformUserPermissionRow = typeof platformUserPermissions.$inferSelect;
export type InsertPlatformUserPermissionRow = typeof platformUserPermissions.$inferInsert;
export type PlatformSettingRow = typeof platformSettings.$inferSelect;
export type InsertPlatformSettingRow = typeof platformSettings.$inferInsert;
export type PlatformEmailIntegrationRow = typeof platformEmailIntegrations.$inferSelect;
export type InsertPlatformEmailIntegrationRow = typeof platformEmailIntegrations.$inferInsert;
export type PlatformSmsIntegrationRow = typeof platformSmsIntegrations.$inferSelect;
export type InsertPlatformSmsIntegrationRow = typeof platformSmsIntegrations.$inferInsert;
export type PlatformActivityLogRow = typeof platformActivityLogs.$inferSelect;
export type InsertPlatformActivityLogRow = typeof platformActivityLogs.$inferInsert;
