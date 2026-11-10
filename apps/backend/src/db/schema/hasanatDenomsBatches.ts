import {
  date,
  pgTable,
  text,
  timestamp,
  index,
  integer,
  primaryKey,
  varchar,
  foreignKey,
  check,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

/** Deed (reward category) definitions and their issued stock batches. */

export const hasanatDenoms = pgTable(
  "hasanat_denoms",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    points: integer("points").notNull().default(0),
    color: varchar("color", { length: 64 }).notNull().default("emerald"),
    description: text("description").notNull().default(""),
    icon: varchar("icon", { length: 64 }).notNull().default("Star"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("hasanat_denoms_workspace_active_idx").on(table.workspaceSubdomain, table.active),
    check("hasanat_denoms_points_chk", sql`${table.points} >= 0`),
  ],
);

export const hasanatBatches = pgTable(
  "hasanat_batches",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    denominationId: text("denomination_id").notNull(),
    denominationName: varchar("denomination_name", { length: 120 }).notNull().default(""),
    quantity: integer("quantity").notNull().default(0),
    /** Maintained by `hasanat_recalc_batch_remaining()` — a projection, never a client value. */
    remaining: integer("remaining").notNull().default(0),
    addedDate: date("added_date", { mode: "string" }).notNull(),
    addedByUserId: text("added_by_user_id"),
    addedBy: varchar("added_by", { length: 120 }),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.denominationId],
      foreignColumns: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
    }).onDelete("cascade"),
    index("hasanat_batches_workspace_denom_idx").on(table.workspaceSubdomain, table.denominationId),
    index("hasanat_batches_workspace_added_date_idx").on(table.workspaceSubdomain, table.addedDate),
    index("hasanat_batches_workspace_added_by_idx").on(
      table.workspaceSubdomain,
      table.addedByUserId,
    ),
    check(
      "hasanat_batches_remaining_chk",
      sql`${table.remaining} >= 0 and ${table.remaining} <= ${table.quantity}`,
    ),
    check("hasanat_batches_quantity_chk", sql`${table.quantity} > 0`),
  ],
);
