import {
  date,
  pgTable,
  text,
  timestamp,
  index,
  jsonb,
  primaryKey,
  varchar,
  numeric,
  integer,
  foreignKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

export const financeInvoices = pgTable(
  "finance_invoices",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    studentName: varchar("student_name", { length: 255 }).notNull().default(""),
    class: varchar("class", { length: 120 }).notNull().default(""),
    session: varchar("session", { length: 120 }).notNull().default(""),
    baseFee: numeric("base_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    discountType: varchar("discount_type", { length: 50 }),
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
    discountAmt: numeric("discount_amt", { precision: 12, scale: 2 }).notNull().default("0"),
    finalAmt: numeric("final_amt", { precision: 12, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    paidDate: date("paid_date", { mode: "string" }),
    method: varchar("method", { length: 50 }),
    paidAmt: numeric("paid_amt", { precision: 12, scale: 2 }),
    invoiceNumber: varchar("invoice_number", { length: 40 }),
    feeStructureId: text("fee_structure_id"),
    billingPeriod: varchar("billing_period", { length: 7 }),
    enrollmentId: varchar("enrollment_id", { length: 64 }),
    familyContactId: varchar("family_contact_id", { length: 64 }),
    lateFeeAmt: numeric("late_fee_amt", { precision: 12, scale: 2 }).notNull().default("0"),
    creditedAmt: numeric("credited_amt", { precision: 12, scale: 2 }).notNull().default("0"),
    lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true, mode: "date" }),
    reminderCount: integer("reminder_count").notNull().default(0),
    /** IAS 21 document currency; NULL = functional currency at rate 1. */
    currency: varchar("currency", { length: 3 }),
    /** Booked rate: functional units per one document unit. */
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("finance_invoices_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    index("finance_invoices_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("finance_invoices_workspace_due_date_idx").on(table.workspaceSubdomain, table.dueDate),
    index("finance_invoices_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("finance_invoices_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("finance_invoices_workspace_status_due_active_idx")
      .on(table.workspaceSubdomain, table.status, table.dueDate)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("finance_invoices_workspace_number_uidx")
      .on(table.workspaceSubdomain, table.invoiceNumber)
      .where(sql`${table.deletedAt} is null and ${table.invoiceNumber} is not null`),
    uniqueIndex("finance_invoices_workspace_enrollment_period_uidx")
      .on(table.workspaceSubdomain, table.enrollmentId, table.billingPeriod)
      .where(
        sql`${table.deletedAt} is null and ${table.enrollmentId} is not null and ${table.billingPeriod} is not null`,
      ),
    index("finance_invoices_workspace_period_idx")
      .on(table.workspaceSubdomain, table.billingPeriod)
      .where(sql`${table.deletedAt} is null`),
    index("finance_invoices_workspace_enrollment_idx")
      .on(table.workspaceSubdomain, table.enrollmentId)
      .where(sql`${table.deletedAt} is null`),
    index("finance_invoices_workspace_family_idx")
      .on(table.workspaceSubdomain, table.familyContactId)
      .where(sql`${table.deletedAt} is null`),
    index("finance_invoices_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const financePayments = pgTable(
  "finance_payments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").notNull(),
    studentId: varchar("student_id", { length: 64 }),
    studentName: varchar("student_name", { length: 255 }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    date: date("date", { mode: "string" }).notNull(),
    method: varchar("method", { length: 50 }).notNull().default("cash"),
    receivedByUserId: text("received_by_user_id"),
    receivedBy: varchar("received_by", { length: 120 }),
    note: text("note").notNull().default(""),
    currency: varchar("currency", { length: 3 }),
    /** Settlement rate on the payment date. */
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }),
    /** Realized FX gain (+) / loss (−) in the functional currency. */
    realizedFx: numeric("realized_fx", { precision: 19, scale: 4 }),
    /** Amount applied to the invoice in its currency (differs from `amount` cross-currency). */
    invoiceAmount: numeric("invoice_amount", { precision: 19, scale: 4 }),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.invoiceId],
      foreignColumns: [financeInvoices.workspaceSubdomain, financeInvoices.id],
    }).onDelete("cascade"),
    index("finance_payments_workspace_invoice_idx").on(table.workspaceSubdomain, table.invoiceId),
    index("finance_payments_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    index("finance_payments_workspace_date_idx").on(table.workspaceSubdomain, table.date),
    index("finance_payments_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("finance_payments_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("finance_payments_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const financeFieldConfigs = pgTable(
  "finance_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const financeModulePreferences = pgTable(
  "finance_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Per-user Finance payments Work column layout (was document-store `finance_payment_user_column_preferences`). */
/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type FinanceInvoiceRow = typeof financeInvoices.$inferSelect;
export type InsertFinanceInvoiceRow = typeof financeInvoices.$inferInsert;
export type FinancePaymentRow = typeof financePayments.$inferSelect;
export type InsertFinancePaymentRow = typeof financePayments.$inferInsert;
export type FinanceFieldConfigsRow = typeof financeFieldConfigs.$inferSelect;
export type InsertFinanceFieldConfigsRow = typeof financeFieldConfigs.$inferInsert;
export type FinanceModulePreferencesRow = typeof financeModulePreferences.$inferSelect;
export type InsertFinanceModulePreferencesRow = typeof financeModulePreferences.$inferInsert;
