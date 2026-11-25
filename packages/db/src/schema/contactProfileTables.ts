import {
  date,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  bigint,
  boolean,
  foreignKey,
  varchar,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { contacts } from "./contactCoreTables.js";

export const contactTags = pgTable(
  "contact_tags",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    /** null = manually created; otherwise the owning module. */
    source: varchar("source", { length: 20 }),
    /** Stable identity for system-managed tags, e.g. `faculty:designation:<id>`. */
    systemKey: varchar("system_key", { length: 200 }),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_tags_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    uniqueIndex("contact_tags_contact_name_uidx").on(
      table.workspaceSubdomain,
      table.contactId,
      table.name,
    ),
    // One row per contact per module role; never let concurrent reconciles duplicate.
    uniqueIndex("contact_tags_ws_contact_system_key_uidx")
      .on(table.workspaceSubdomain, table.contactId, table.systemKey)
      .where(sql`${table.systemKey} is not null`),
    // Reconcile/rename lookups by role key.
    index("contact_tags_ws_system_key_idx")
      .on(table.workspaceSubdomain, table.systemKey)
      .where(sql`${table.systemKey} is not null`),
    // A manual tag can never shadow a system tag by casing/spacing.
    uniqueIndex("contact_tags_ws_contact_lower_name_uidx").on(
      table.workspaceSubdomain,
      table.contactId,
      sql`lower(btrim(${table.name}))`,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactSocials = pgTable(
  "contact_socials",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    platform: varchar("platform", { length: 50 }).notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_socials_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactEducations = pgTable(
  "contact_educations",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    degree: varchar("degree", { length: 150 }),
    institution: varchar("institution", { length: 255 }).notNull(),
    fieldOfStudy: varchar("field_of_study", { length: 255 }),
    year: varchar("year", { length: 50 }),
    grade: varchar("grade", { length: 50 }),
    label: varchar("label", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_educations_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactExperiences = pgTable(
  "contact_experiences",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    organization: varchar("organization", { length: 255 }).notNull(),
    employmentType: varchar("employment_type", { length: 100 }),
    location: varchar("location", { length: 255 }),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    isCurrent: boolean("is_current").notNull().default(false),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_experiences_workspace_contact_idx").on(
      table.workspaceSubdomain,
      table.contactId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactSkills = pgTable(
  "contact_skills",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }),
    proficiency: varchar("proficiency", { length: 50 }),
    yearsOfExperience: varchar("years_of_experience", { length: 50 }),
    isCertified: boolean("is_certified").notNull().default(false),
    issuer: varchar("issuer", { length: 255 }),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_skills_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactRelationships = pgTable(
  "contact_relationships",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    relatedContactId: text("related_contact_id"),
    name: varchar("name", { length: 255 }),
    relationship: varchar("relationship", { length: 100 }),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    gender: varchar("gender", { length: 20 }),
    inferred: boolean("inferred").notNull().default(false),
    inferredFromContactId: varchar("inferred_from_contact_id", { length: 64 }),
    inferenceDepth: integer("inference_depth").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_relationships_workspace_contact_idx").on(
      table.workspaceSubdomain,
      table.contactId,
    ),
    index("contact_relationships_workspace_related_idx").on(
      table.workspaceSubdomain,
      table.relatedContactId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.relatedContactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("set null"),
  ],
);

export const contactActivities = pgTable(
  "contact_activities",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    content: text("content").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    by: varchar("by", { length: 64 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_activities_workspace_contact_idx").on(table.workspaceSubdomain, table.contactId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactAttachments = pgTable(
  "contact_attachments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull().default(0),
    url: text("url").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_attachments_workspace_contact_idx").on(
      table.workspaceSubdomain,
      table.contactId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);

export const contactBankDetails = pgTable(
  "contact_bank_details",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    bankName: varchar("bank_name", { length: 255 }),
    accountTitle: varchar("account_title", { length: 255 }),
    accountNumber: varchar("account_number", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.contactId, table.id] }),
    index("contact_bank_details_workspace_contact_idx").on(
      table.workspaceSubdomain,
      table.contactId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
  ],
);
