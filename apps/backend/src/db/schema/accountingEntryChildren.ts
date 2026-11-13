import {
  index,
  pgTable,
  text,
  timestamp,
  primaryKey,
  varchar,
  foreignKey,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";
import { accountingEntries } from "./accounting.js";

/**
 * Child tables of `accounting_entries`, split out of `accounting.ts` to keep the
 * model file inside the 300-line ceiling. They depend on `accounting_entries`
 * only, so the dependency direction stays acyclic (the barrel in `index.ts`
 * re-exports both).
 */

export const accountingEntryTags = pgTable(
  "accounting_entry_tags",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull(),
    tag: varchar("tag", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.entryId, table.tag] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.entryId],
      foreignColumns: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }).onDelete("cascade"),
    index("accounting_entry_tags_workspace_entry_idx").on(table.workspaceSubdomain, table.entryId),
  ],
);

export const accountingEntryAttachments = pgTable(
  "accounting_entry_attachments",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.entryId, table.url] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.entryId],
      foreignColumns: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }).onDelete("cascade"),
    index("accounting_entry_attachments_workspace_entry_idx").on(
      table.workspaceSubdomain,
      table.entryId,
    ),
  ],
);

export type AccountingEntryTagRow = typeof accountingEntryTags.$inferSelect;
export type InsertAccountingEntryTagRow = typeof accountingEntryTags.$inferInsert;
export type AccountingEntryAttachmentRow = typeof accountingEntryAttachments.$inferSelect;
export type InsertAccountingEntryAttachmentRow = typeof accountingEntryAttachments.$inferInsert;
