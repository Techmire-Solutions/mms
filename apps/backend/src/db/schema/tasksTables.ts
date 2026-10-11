import {
  pgTable,
  text,
  timestamp,
  varchar,
  date,
  primaryKey,
  foreignKey,
  index,
  check,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { faculty } from "./faculty.js";
import { facultyAssignments } from "./facultyAssignmentTables.js";
import { tenantUsers } from "./contacts.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

/**
 * Tasks table supporting hierarchical delegation, priority, and lifecycle states.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).notNull().default("todo"),
    priority: varchar("priority", { length: 32 }).notNull().default("medium"),
    startDate: date("start_date", { mode: "string" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    parentTaskId: text("parent_task_id"),
    createdByUserId: text("created_by_user_id").notNull(),
    assignedByUserId: text("assigned_by_user_id"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),

    index("tasks_status_active_idx")
      .on(table.workspaceSubdomain, table.status)
      .where(sql`${table.deletedAt} is null`),

    index("tasks_priority_active_idx")
      .on(table.workspaceSubdomain, table.priority)
      .where(sql`${table.deletedAt} is null`),

    index("tasks_due_at_active_idx")
      .on(table.workspaceSubdomain, table.dueAt)
      .where(sql`${table.deletedAt} is null`),

    index("tasks_parent_task_active_idx")
      .on(table.workspaceSubdomain, table.parentTaskId)
      .where(sql`${table.deletedAt} is null`),

    index("tasks_deleted_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),

    check(
      "tasks_status_check",
      sql`${table.status} in ('todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled')`,
    ),

    check("tasks_priority_check", sql`${table.priority} in ('low', 'medium', 'high', 'urgent')`),

    foreignKey({
      columns: [table.workspaceSubdomain, table.parentTaskId],
      foreignColumns: [table.workspaceSubdomain, table.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Task assignees supporting multiple assignees per task.
 */
export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    facultyId: text("faculty_id").notNull(),
    facultyAssignmentId: text("faculty_assignment_id"),
    userId: text("user_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    assignedByUserId: text("assigned_by_user_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),

    index("task_assignees_task_active_idx")
      .on(table.workspaceSubdomain, table.taskId)
      .where(sql`${table.deletedAt} is null`),

    index("task_assignees_user_active_idx")
      .on(table.workspaceSubdomain, table.userId)
      .where(sql`${table.deletedAt} is null`),

    index("task_assignees_faculty_active_idx")
      .on(table.workspaceSubdomain, table.facultyId)
      .where(sql`${table.deletedAt} is null`),

    index("task_assignees_deleted_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),

    uniqueIndex("task_assignees_recipient_active_uidx")
      .on(table.workspaceSubdomain, table.taskId, table.userId)
      .where(sql`${table.deletedAt} is null`),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyAssignmentId],
      foreignColumns: [facultyAssignments.workspaceSubdomain, facultyAssignments.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.userId],
      foreignColumns: [tenantUsers.workspaceSubdomain, tenantUsers.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.taskId],
      foreignColumns: [tasks.workspaceSubdomain, tasks.id],
    }).onDelete("cascade"),
  ],
);

export type TaskRow = typeof tasks.$inferSelect;
export type InsertTaskRow = typeof tasks.$inferInsert;
export type TaskAssigneeRow = typeof taskAssignees.$inferSelect;
export type InsertTaskAssigneeRow = typeof taskAssignees.$inferInsert;
