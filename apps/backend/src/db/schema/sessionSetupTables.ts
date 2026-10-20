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
  varchar,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";
import { sessionClasses } from "./sessionCoreTables.js";

/**
 * Scholarship Eligibility criteria profiles (Model 6).
 */
export const scholarshipEligibilities = pgTable(
  "scholarship_eligibilities",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    orphan: boolean("orphan").notNull().default(false),
    job: boolean("job").notNull().default(false),
    business: boolean("business").notNull().default(false),
    property: boolean("property").notNull().default(false),
    familyMembers: integer("family_members").notNull().default(1),
    onJobMembers: integer("on_job_members").notNull().default(0),
    schoolGoingSiblings: integer("school_going_siblings").notNull().default(0),
    residence: varchar("residence", { length: 100 }).notNull().default("rental"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("scholarship_eligibilities_workspace_idx").on(table.workspaceSubdomain),
  ],
);

/**
 * Session Class Scholarships (Model 6).
 */
export const sessionClassScholarships = pgTable(
  "session_class_scholarships",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    scholarshipEligibilityId: text("scholarship_eligibility_id"),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    expiryDate: date("expiry_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_scholarships_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_scholarships_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Lookups & Setup Tables
 */
export const sessionLookups = pgTable(
  "session_lookups",
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
    uniqueIndex("session_lookups_workspace_kind_sort_idx").on(
      table.workspaceSubdomain,
      table.kind,
      table.sortOrder,
    ),
    index("session_lookups_workspace_kind_idx").on(table.workspaceSubdomain, table.kind),
  ],
);

export const sessionFieldConfigs = pgTable(
  "session_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const sessionModulePreferences = pgTable(
  "session_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);
