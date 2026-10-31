import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  varchar,
  numeric,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";

/**
 * Platform-level consolidation groups (IFRS 10). Members reference workspaces by
 * `member_subdomain` — these rows belong to the platform, not to any tenant, so
 * they carry no `workspace_subdomain` and no tenant RLS policy; access is gated
 * by platform permissions.
 */
export const consolidationGroups = pgTable("consolidation_groups", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  presentationCurrency: varchar("presentation_currency", { length: 3 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export const consolidationGroupMembers = pgTable(
  "consolidation_group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => consolidationGroups.id, { onDelete: "cascade" }),
    memberSubdomain: text("member_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    ownershipPercent: numeric("ownership_percent", { precision: 7, scale: 4 }).notNull(),
    isParent: boolean("is_parent").notNull().default(false),
    closingRate: numeric("closing_rate", { precision: 20, scale: 10 }),
    averageRate: numeric("average_rate", { precision: 20, scale: 10 }),
    historicalRate: numeric("historical_rate", { precision: 20, scale: 10 }),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.memberSubdomain] }),
    index("consolidation_group_members_member_idx").on(table.memberSubdomain),
  ],
);

export const consolidationIntercompanyAccounts = pgTable(
  "consolidation_intercompany_accounts",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => consolidationGroups.id, { onDelete: "cascade" }),
    accountCode: varchar("account_code", { length: 50 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.accountCode] })],
);
