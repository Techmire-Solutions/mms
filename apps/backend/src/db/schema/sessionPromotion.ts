import { index, integer, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";

/** One rollover (duplicate / promote) of a session into a new draft session (migration 0177). */
export const sessionPromotionRuns = pgTable(
  "session_promotion_runs",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sourceSessionId: text("source_session_id").notNull(),
    targetSessionId: text("target_session_id"),
    mode: varchar("mode", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("queued"),
    promoted: integer("promoted").notNull().default(0),
    retained: integer("retained").notNull().default(0),
    graduated: integer("graduated").notNull().default(0),
    left: integer("left").notNull().default(0),
    error: varchar("error", { length: 1000 }),
    jobId: text("job_id"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("session_promotion_runs_source_idx").on(
      table.workspaceSubdomain,
      table.sourceSessionId,
      table.createdAt,
    ),
    index("session_promotion_runs_target_idx").on(table.workspaceSubdomain, table.targetSessionId),
  ],
);

/** Source class → class whose copy receives its students (null = graduate). */
export const sessionPromotionClassMap = pgTable(
  "session_promotion_class_map",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    sourceClassId: text("source_class_id").notNull(),
    nextClassId: text("next_class_id"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.runId, table.sourceClassId] }),
  ],
);

export type SessionPromotionRunRow = typeof sessionPromotionRuns.$inferSelect;
export type SessionPromotionRunInsert = typeof sessionPromotionRuns.$inferInsert;
