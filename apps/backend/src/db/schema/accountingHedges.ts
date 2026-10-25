import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  varchar,
  numeric,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

/** IFRS 9.6.4.1 designated FX forward hedge relationships with their documentation. */
export const accountingHedgeRelationships = pgTable(
  "accounting_hedge_relationships",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    hedgeType: varchar("hedge_type", { length: 20 }).notNull(),
    direction: varchar("direction", { length: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    notional: numeric("notional", { precision: 19, scale: 4 }).notNull(),
    contractRate: numeric("contract_rate", { precision: 20, scale: 10 }).notNull(),
    designationRate: numeric("designation_rate", { precision: 20, scale: 10 }).notNull(),
    designationDate: varchar("designation_date", { length: 10 }).notNull(),
    maturityDate: varchar("maturity_date", { length: 10 }).notNull(),
    hedgedItem: text("hedged_item").notNull(),
    riskManagementObjective: text("risk_management_objective").notNull(),
    instrumentAccountId: text("instrument_account_id").notNull(),
    reserveAccountId: text("reserve_account_id"),
    pnlAccountId: text("pnl_account_id").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    settledReserve: numeric("settled_reserve", { precision: 19, scale: 4 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("accounting_hedge_relationships_status_idx").on(table.workspaceSubdomain, table.status),
    check("accounting_hedge_relationships_type", sql`${table.hedgeType} IN ('cash_flow', 'fair_value')`),
    check("accounting_hedge_relationships_direction", sql`${table.direction} IN ('buy', 'sell')`),
    check(
      "accounting_hedge_relationships_status",
      sql`${table.status} IN ('active', 'settled', 'reclassified', 'discontinued')`,
    ),
    check("accounting_hedge_relationships_notional", sql`${table.notional} > 0`),
  ],
);

/** Each posted valuation, settlement or reserve reclassification of a hedge relationship. */
export const accountingHedgeValuations = pgTable(
  "accounting_hedge_valuations",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    relationshipId: text("relationship_id").notNull(),
    valuationDate: varchar("valuation_date", { length: 10 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    instrumentValue: numeric("instrument_value", { precision: 19, scale: 4 }).notNull(),
    hedgedChange: numeric("hedged_change", { precision: 19, scale: 4 }).notNull(),
    effective: numeric("effective", { precision: 19, scale: 4 }).notNull(),
    ineffective: numeric("ineffective", { precision: 19, scale: 4 }).notNull(),
    entryId: text("entry_id"),
    reversalEntryId: text("reversal_entry_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.relationshipId],
      foreignColumns: [accountingHedgeRelationships.workspaceSubdomain, accountingHedgeRelationships.id],
    }).onDelete("cascade"),
    uniqueIndex("accounting_hedge_valuations_date_uidx").on(
      table.workspaceSubdomain,
      table.relationshipId,
      table.valuationDate,
      table.kind,
    ),
    check(
      "accounting_hedge_valuations_kind",
      sql`${table.kind} IN ('valuation', 'settlement', 'reclassification')`,
    ),
  ],
);
