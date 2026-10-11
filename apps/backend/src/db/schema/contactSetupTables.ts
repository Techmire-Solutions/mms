import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  boolean,
  jsonb,
  primaryKey,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { contacts } from "./contactCoreTables.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

/** Madrasa workspace auth users — isolated per subdomain. */
export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: text("id").primaryKey(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    loginEmail: text("login_email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull().default(""),
    role: text("role").notNull().default("assistant_teacher"),
    contactId: text("contact_id"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
    pendingLoginEmail: text("pending_login_email"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** Non-auth profile fields from legacy JSON user rows. */
    profileJson: jsonb("profile_json").$type<Record<string, unknown>>(),
  },
  (table) => [
    unique("tenant_users_workspace_subdomain_id_uniq").on(table.workspaceSubdomain, table.id),
    uniqueIndex("tenant_users_workspace_login_email_active_idx")
      .on(table.workspaceSubdomain, table.loginEmail)
      .where(sql`${table.deletedAt} is null`),
    index("tenant_users_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("tenant_users_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("tenant_users_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    index("tenant_users_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    index("tenant_users_workspace_contact_active_idx")
      .on(table.workspaceSubdomain, table.contactId)
      .where(sql`${table.deletedAt} is null`),
    index("tenant_users_workspace_role_active_idx")
      .on(table.workspaceSubdomain, table.role)
      .where(sql`${table.deletedAt} is null`),
    index("tenant_users_workspace_name_active_idx")
      .on(table.workspaceSubdomain, table.name)
      .where(sql`${table.deletedAt} is null`),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("set null"),
  ],
);

/** Per-user Google Contacts OAuth credentials — never stored in objects KV. */
export const contactGoogleSyncCredentials = pgTable(
  "contact_google_sync_credentials",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    clientId: text("client_id"),
    clientSecret: text("client_secret"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain, table.userId] })],
);

/**
 * Contacts Setup option lists (genders, labels, country dial codes, …).
 * Replaces unscoped document-store `collections` KV for these kinds.
 */
export const contactLookups = pgTable(
  "contact_lookups",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    uniqueIndex("contact_lookups_workspace_kind_sort_idx").on(
      table.workspaceSubdomain,
      table.kind,
      table.sortOrder,
    ),
    index("contact_lookups_workspace_kind_idx").on(table.workspaceSubdomain, table.kind),
  ],
);

/** Contacts Setup field registry (was document-store `contact_field_config`). */
export const contactFieldConfigs = pgTable(
  "contact_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Contacts Setup preferences (was document-store `contact_preferences`). */
export const contactModulePreferences = pgTable(
  "contact_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Per-user Contacts Work column layout (was document-store `contact_user_column_preferences`). */
