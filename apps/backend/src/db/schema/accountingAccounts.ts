import {
  boolean,
  check,
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
import { softDeleteColumns } from "./softDeleteSchema.js";
import { fxAccountColumns } from "./accountingFxColumns.js";

/**
 * Chart of accounts. Split out of `accounting.ts` so the model file stays inside
 * the 300-line ceiling (same precedent as `accountingEntryChildren.ts`); the
 * barrel in `accounting.ts`/`index.ts` re-exports it.
 *
 * Hierarchy: `parent_account_id` is a composite self-FK, so a parent can only be
 * an account of the same workspace. The 0253 trigger rejects self-parenting,
 * cycles and chains deeper than {@link ACCOUNT_HIERARCHY_MAX_DEPTH}, taking a
 * per-tenant advisory lock so concurrent reparents cannot close a loop. The
 * application-level mirror of those rules is
 * `@mms/shared` `checkAccountParent`.
 */
export const accountingAccounts = pgTable(
  "accounting_accounts",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    subtype: varchar("subtype", { length: 100 }).notNull().default(""),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    /** COA parent; null = root. Cycles/depth are enforced by the 0253 trigger. */
    parentAccountId: text("parent_account_id"),
    ...fxAccountColumns,
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    // NO ACTION (the default), not RESTRICT: the constraint must still stop a lone
    // parent delete, but a whole-tree/whole-workspace DELETE has to pass — RESTRICT
    // fires per row and would make the result depend on the order PostgreSQL happens
    // to visit the rows.
    foreignKey({
      columns: [table.workspaceSubdomain, table.parentAccountId],
      foreignColumns: [table.workspaceSubdomain, table.id],
    }),
    /** Account codes are the ledger's join key, so one active account per code. */
    uniqueIndex("accounting_accounts_workspace_code_active_uidx")
      .on(table.workspaceSubdomain, table.code)
      .where(sql`${table.deletedAt} is null`),
    index("accounting_accounts_workspace_code_idx").on(table.workspaceSubdomain, table.code),
    index("accounting_accounts_workspace_type_idx").on(table.workspaceSubdomain, table.type),
    index("accounting_accounts_workspace_type_active_idx")
      .on(table.workspaceSubdomain, table.type)
      .where(sql`${table.deletedAt} is null`),
    index("accounting_accounts_workspace_parent_active_idx")
      .on(table.workspaceSubdomain, table.parentAccountId)
      .where(sql`${table.deletedAt} is null`),
    /** COA directory default ordering (`created_at DESC, id`). */
    index("accounting_accounts_workspace_created_active_idx")
      .on(table.workspaceSubdomain, sql`${table.createdAt} desc`, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("accounting_accounts_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("accounting_accounts_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("accounting_accounts_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    /**
     * Legal account types are single-sourced in `@mms/shared`
     * `ACCOUNTING_ACCOUNT_TYPES`; `financeAccountingConstraintsParity` pins this
     * list to it (the 0252 taxonomy pattern).
     */
    check(
      "accounting_accounts_type_chk",
      sql`${table.type} IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')`,
    ),
    check(
      "accounting_accounts_parent_not_self_chk",
      sql`${table.parentAccountId} is null or ${table.parentAccountId} <> ${table.id}`,
    ),
  ],
);

export type AccountingAccountRow = typeof accountingAccounts.$inferSelect;
export type InsertAccountingAccountRow = typeof accountingAccounts.$inferInsert;
