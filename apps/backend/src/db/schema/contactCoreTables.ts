import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  date,
  boolean,
  foreignKey,
  varchar,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 150 }).notNull(),
    lastName: varchar("last_name", { length: 150 }),
    name: varchar("name", { length: 300 }).notNull(),
    gender: varchar("gender", { length: 20 }),
    dob: date("dob", { mode: "string" }),
    cnic: varchar("cnic", { length: 30 }),
    isSyed: boolean("is_syed").notNull().default(false),
    avatar: text("avatar"),
    notes: text("notes"),
    whatsappStatus: varchar("whatsapp_status", { length: 30 }).notNull().default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, mode: "date" }),
    aiSummary: text("ai_summary"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("contacts_workspace_cnic_idx").on(table.workspaceSubdomain, table.cnic),
    index("contacts_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("contacts_workspace_created_at_active_idx")
      .on(table.workspaceSubdomain, table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_updated_at_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_id_active_idx")
      .on(table.workspaceSubdomain, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_gender_id_active_idx")
      .on(table.workspaceSubdomain, table.gender, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_gender_created_at_active_idx")
      .on(table.workspaceSubdomain, table.gender, table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_gender_updated_at_active_idx")
      .on(table.workspaceSubdomain, table.gender, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_gender_expr_updated_at_active_idx")
      .on(
        table.workspaceSubdomain,
        sql`(lower(btrim(COALESCE(${table.gender}, ''))))`,
        table.updatedAt,
      )
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_gender_expr_id_active_idx")
      .on(table.workspaceSubdomain, sql`(lower(btrim(COALESCE(${table.gender}, ''))))`, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_is_syed_active_idx")
      .on(table.workspaceSubdomain, table.isSyed, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_name_active_idx")
      .on(table.workspaceSubdomain, table.name)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_first_name_active_idx")
      .on(table.workspaceSubdomain, table.firstName)
      .where(sql`${table.deletedAt} is null`),
    index("contacts_workspace_last_name_active_idx")
      .on(table.workspaceSubdomain, table.lastName)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("contacts_workspace_cnic_active_uidx")
      .on(table.workspaceSubdomain, sql`(regexp_replace(${table.cnic}, '[^0-9]', '', 'g'))`)
      .where(
        sql`${table.deletedAt} is null and nullif(regexp_replace(${table.cnic}, '[^0-9]', '', 'g'), '') is not null`,
      ),
    index("contacts_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const contactPhones = pgTable(
  "contact_phones",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    number: varchar("number", { length: 50 }).notNull(),
    label: varchar("label", { length: 100 }),
    countryCode: varchar("country_code", { length: 10 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    whatsappStatus: varchar("whatsapp_status", { length: 30 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_phones_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    index("contact_phones_workspace_number_idx").on(table.workspaceSubdomain, table.number),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactEmails = pgTable(
  "contact_emails",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    address: varchar("address", { length: 255 }).notNull(),
    label: varchar("label", { length: 100 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_emails_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    index("contact_emails_workspace_address_idx").on(table.workspaceSubdomain, table.address),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactAddresses = pgTable(
  "contact_addresses",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    label: varchar("label", { length: 100 }),
    line1: varchar("line1", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    country: varchar("country", { length: 100 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_addresses_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);
