import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
  varchar,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    labelKey: varchar("label_key", { length: 255 }),
    body: text("body").notNull(),
    category: varchar("category", { length: 50 }).notNull().default("general"),
    channel: varchar("channel", { length: 50 }).notNull().default("all"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("message_templates_workspace_category_idx").on(table.workspaceSubdomain, table.category),
    index("message_templates_workspace_channel_idx").on(table.workspaceSubdomain, table.channel),
  ],
);

export const messageLogs = pgTable(
  "message_logs",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    userId: text("user_id").notNull().default(""),
    contactId: varchar("contact_id", { length: 64 }).notNull(),
    channel: varchar("channel", { length: 30 }).notNull(),
    body: text("body").notNull(),
    sentAt: varchar("sent_at", { length: 35 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("sent"),
    subject: varchar("subject", { length: 500 }),
    category: varchar("category", { length: 50 }).notNull().default("general"),
    errorMessage: varchar("error_message", { length: 1000 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: text("deleted_by"),
    deletionReason: varchar("deletion_reason", { length: 500 }),
    /** Generated column: TTL expiry = deleted_at + 365 days (retentionDays = 365 per §13.4). */
    purgeAfter: timestamp("purge_after", { withTimezone: true, mode: "date" }).generatedAlwaysAs(
      sql`deleted_at + INTERVAL '365 days'`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("message_logs_workspace_channel_idx").on(table.workspaceSubdomain, table.channel),
    index("message_logs_workspace_category_idx").on(table.workspaceSubdomain, table.category),
    index("message_logs_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("message_logs_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    index("message_logs_workspace_sent_at_idx").on(table.workspaceSubdomain, table.sentAt),
    index("message_logs_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("message_logs_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("message_logs_workspace_sent_at_active_idx")
      .on(table.workspaceSubdomain, table.sentAt)
      .where(sql`${table.deletedAt} is null`),
    index("message_logs_workspace_user_sent_active_idx")
      .on(table.workspaceSubdomain, table.userId, desc(table.sentAt))
      .where(sql`${table.deletedAt} is null`),
    index("message_logs_workspace_channel_status_sent_active_idx")
      .on(table.workspaceSubdomain, table.channel, table.status, desc(table.sentAt))
      .where(sql`${table.deletedAt} is null`),
    index("message_logs_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    /** Planner-efficient index for purge worker candidate selection (§13.2). */
    index("message_logs_purge_after_idx")
      .on(table.workspaceSubdomain, table.purgeAfter)
      .where(sql`${table.deletedAt} is not null and ${table.purgeAfter} is not null`),
  ],
);

/** Tenant-scoped email integration config & credentials — replaces objects KV (email_integration / email_integration_secrets). */
export const emailIntegrations = pgTable("email_integrations", {
  workspaceSubdomain: text("workspace_subdomain")
    .primaryKey()
    .references(() => workspaces.subdomain, { onDelete: "cascade" }),
  providerId: varchar("provider_id", { length: 40 }).notNull().default("gmail"),
  fromAddress: varchar("from_address", { length: 255 }).notNull().default(""),
  fromName: varchar("from_name", { length: 255 }).notNull().default("Madrasa Management System"),
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

/** Tenant-scoped SMS provider config & credentials — exactly one provider active per tenant. */
export const smsIntegrations = pgTable("sms_integrations", {
  workspaceSubdomain: text("workspace_subdomain")
    .primaryKey()
    .references(() => workspaces.subdomain, { onDelete: "cascade" }),
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

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type MessageTemplateRow = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplateRow = typeof messageTemplates.$inferInsert;
export type MessageLogRow = typeof messageLogs.$inferSelect;
export type InsertMessageLogRow = typeof messageLogs.$inferInsert;

export type EmailIntegrationRow = typeof emailIntegrations.$inferSelect;
export type InsertEmailIntegrationRow = typeof emailIntegrations.$inferInsert;

export type SmsIntegrationRow = typeof smsIntegrations.$inferSelect;
export type InsertSmsIntegrationRow = typeof smsIntegrations.$inferInsert;
