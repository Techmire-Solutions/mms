import {
  date,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { enrollments } from "./enrollments.js";
import { sessionClassSections } from "./sessionSections.js";
import { sessionClasses } from "./sessions.js";

/**
 * Student × class × section over [start_on, end_on] (migration 0175). Transfers close the open row
 * and open a new one; `enrollments.class_id / section_id` mirror the open row.
 */
export const enrollmentPlacements = pgTable(
  "enrollment_placements",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id").notNull(),
    classId: text("class_id").notNull(),
    sectionId: text("section_id"),
    startOn: date("start_on", { mode: "string" }).notNull(),
    endOn: date("end_on", { mode: "string" }),
    reason: varchar("reason", { length: 500 }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "enrollment_placements_enrollment_fk",
      columns: [table.workspaceSubdomain, table.enrollmentId],
      foreignColumns: [enrollments.workspaceSubdomain, enrollments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "enrollment_placements_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }),
    foreignKey({
      name: "enrollment_placements_section_fk",
      columns: [table.workspaceSubdomain, table.sectionId],
      foreignColumns: [sessionClassSections.workspaceSubdomain, sessionClassSections.id],
    }),
    uniqueIndex("enrollment_placements_open_uidx")
      .on(table.workspaceSubdomain, table.enrollmentId)
      .where(sql`${table.endOn} is null`),
    index("enrollment_placements_enrollment_idx").on(
      table.workspaceSubdomain,
      table.enrollmentId,
      table.startOn,
    ),
    index("enrollment_placements_class_idx").on(table.workspaceSubdomain, table.classId),
    index("enrollment_placements_section_idx").on(table.workspaceSubdomain, table.sectionId),
  ],
);

export type EnrollmentPlacementRow = typeof enrollmentPlacements.$inferSelect;
export type EnrollmentPlacementInsert = typeof enrollmentPlacements.$inferInsert;
