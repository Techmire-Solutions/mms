import { pgTable, text, timestamp, primaryKey, varchar, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

/**
 * IAS 21.8–19 (2025 amendment): currencies assessed as not exchangeable into
 * the functional currency. A row means "not exchangeable"; while it exists the
 * reference feed is ignored and only tenant-estimated spot rates apply.
 */
export const accountingCurrencyExchangeability = pgTable(
  "accounting_currency_exchangeability",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    assessedOn: varchar("assessed_on", { length: 10 }).notNull(),
    /** How the estimated spot rate is determined (IAS 21.57A disclosure). */
    estimationMethod: text("estimation_method").notNull(),
    /** Why the currency is not exchangeable and the risks that creates. */
    reason: text("reason").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.currency] }),
    check("accounting_currency_exchangeability_iso", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);
