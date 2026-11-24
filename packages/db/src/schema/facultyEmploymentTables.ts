import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
  varchar,
  date,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { contacts } from "./contacts.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

/**
 * Employment Records — owns the Contact link and Employee Code.
 *
 * Faculty Management model: Employment ID (`id`), Setup-generated `employee_id`
 * (Employee Code), `contact_id`, employment start/end, five-value lifecycle status.
 * Faculty profiles reference this row via `faculty.employment_id`.
 */
export const facultyEmployments = pgTable(
  "faculty_employments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    /** Employee Code from Setup → Employee ID Configuration. */
    employeeId: varchar("employee_id", { length: 100 }),
    employmentStartDate: date("employment_start_date", { mode: "string" }),
    employmentEndDate: date("employment_end_date", { mode: "string" }),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("faculty_employments_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("faculty_employments_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("faculty_employments_contact_active_uidx")
      .on(table.workspaceSubdomain, table.contactId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("faculty_employments_employee_id_active_uidx")
      .on(table.workspaceSubdomain, table.employeeId)
      .where(sql`${table.deletedAt} is null and ${table.employeeId} is not null`),
    index("faculty_employments_status_active_idx")
      .on(table.workspaceSubdomain, table.status)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_employments_deleted_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check(
      "faculty_employments_status_check",
      sql`lower(btrim(${table.status})) in ('active', 'on_leave', 'inactive', 'retired', 'terminated')`,
    ),
    check(
      "faculty_employments_period_check",
      sql`${table.employmentEndDate} is null or ${table.employmentStartDate} is null or ${table.employmentEndDate} >= ${table.employmentStartDate}`,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("restrict"),
  ],
);

export type FacultyEmploymentRow = typeof facultyEmployments.$inferSelect;
export type InsertFacultyEmploymentRow = typeof facultyEmployments.$inferInsert;
