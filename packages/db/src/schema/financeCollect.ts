import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
  varchar,
  numeric,
  foreignKey,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";
import { financeInvoices } from "./finance.js";

export const financeCreditNotes = pgTable(
  "finance_credit_notes",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    reason: varchar("reason", { length: 200 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.invoiceId],
      foreignColumns: [financeInvoices.workspaceSubdomain, financeInvoices.id],
    }).onDelete("cascade"),
    index("finance_credit_notes_workspace_invoice_idx").on(
      table.workspaceSubdomain,
      table.invoiceId,
    ),
  ],
);

export type FinanceCreditNoteRow = typeof financeCreditNotes.$inferSelect;
export type InsertFinanceCreditNoteRow = typeof financeCreditNotes.$inferInsert;
