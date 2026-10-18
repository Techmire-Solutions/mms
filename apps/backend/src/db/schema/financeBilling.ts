import {
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  primaryKey,
  varchar,
  numeric,
  integer,
  foreignKey,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";
import { financeInvoices, financePayments } from "./finance.js";
import { accountingAccounts } from "./accounting.js";
import { sessions, sessionClasses } from "./sessions.js";
import { programs } from "./academicCatalogs.js";

export const financeFeeStructures = pgTable(
  "finance_fee_structures",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    session: varchar("session", { length: 120 }).notNull().default(""),
    className: varchar("class_name", { length: 120 }).notNull().default(""),
    /** Typed references (migration 0171); `session` / `className` stay as display snapshots. */
    sessionId: text("session_id"),
    classId: text("class_id"),
    programId: text("program_id"),
    frequency: varchar("frequency", { length: 20 }).notNull().default("monthly"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("finance_fee_structures_workspace_active_idx").on(
      table.workspaceSubdomain,
      table.isActive,
    ),
    foreignKey({
      name: "finance_fee_structures_session_fk",
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "finance_fee_structures_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "finance_fee_structures_program_fk",
      columns: [table.workspaceSubdomain, table.programId],
      foreignColumns: [programs.workspaceSubdomain, programs.id],
    }).onDelete("restrict"),
    index("finance_fee_structures_session_idx").on(table.workspaceSubdomain, table.sessionId),
    index("finance_fee_structures_class_idx").on(table.workspaceSubdomain, table.classId),
    index("finance_fee_structures_program_idx").on(table.workspaceSubdomain, table.programId),
  ],
);

export const financeFeeItems = pgTable(
  "finance_fee_items",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    structureId: text("structure_id").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    incomeAccountId: text("income_account_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.structureId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.structureId],
      foreignColumns: [financeFeeStructures.workspaceSubdomain, financeFeeStructures.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.incomeAccountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    index("finance_fee_items_workspace_structure_idx").on(
      table.workspaceSubdomain,
      table.structureId,
    ),
  ],
);

export const financeInvoiceLines = pgTable(
  "finance_invoice_lines",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").notNull(),
    feeItemId: text("fee_item_id"),
    description: varchar("description", { length: 200 }).notNull().default(""),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    discountAmt: numeric("discount_amt", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.invoiceId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.invoiceId],
      foreignColumns: [financeInvoices.workspaceSubdomain, financeInvoices.id],
    }).onDelete("cascade"),
    index("finance_invoice_lines_workspace_invoice_idx").on(
      table.workspaceSubdomain,
      table.invoiceId,
    ),
  ],
);

export const financePaymentAllocations = pgTable(
  "finance_payment_allocations",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    paymentId: text("payment_id").notNull(),
    invoiceId: text("invoice_id").notNull(),
    invoiceLineId: text("invoice_line_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.paymentId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.paymentId],
      foreignColumns: [financePayments.workspaceSubdomain, financePayments.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.invoiceId],
      foreignColumns: [financeInvoices.workspaceSubdomain, financeInvoices.id],
    }),
    index("finance_payment_allocations_workspace_payment_idx").on(
      table.workspaceSubdomain,
      table.paymentId,
    ),
    index("finance_payment_allocations_workspace_invoice_idx").on(
      table.workspaceSubdomain,
      table.invoiceId,
    ),
  ],
);

export type FinanceFeeStructureRow = typeof financeFeeStructures.$inferSelect;
export type InsertFinanceFeeStructureRow = typeof financeFeeStructures.$inferInsert;
export type FinanceFeeItemRow = typeof financeFeeItems.$inferSelect;
export type InsertFinanceFeeItemRow = typeof financeFeeItems.$inferInsert;
export type FinanceInvoiceLineRow = typeof financeInvoiceLines.$inferSelect;
export type InsertFinanceInvoiceLineRow = typeof financeInvoiceLines.$inferInsert;
export type FinancePaymentAllocationRow = typeof financePaymentAllocations.$inferSelect;
export type InsertFinancePaymentAllocationRow = typeof financePaymentAllocations.$inferInsert;
