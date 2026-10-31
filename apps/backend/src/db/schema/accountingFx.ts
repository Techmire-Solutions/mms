import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
  varchar,
  numeric,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

const isoCode = (column: string) => varchar(column, { length: 3 });

/** One row per tenant: the IAS 21 functional and presentation currencies. */
export const accountingCurrencySettings = pgTable(
  "accounting_currency_settings",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    functionalCurrency: isoCode("functional_currency").notNull(),
    presentationCurrency: isoCode("presentation_currency").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain] }),
    check(
      "accounting_currency_settings_functional_iso",
      sql`${table.functionalCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "accounting_currency_settings_presentation_iso",
      sql`${table.presentationCurrency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

/** Foreign currencies a tenant may transact in (the functional one is implicit). */
export const accountingEnabledCurrencies = pgTable(
  "accounting_enabled_currencies",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    currency: isoCode("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.currency] }),
    check("accounting_enabled_currencies_iso", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/** Tenant-maintained rates; these win over feed rates for the same key. */
export const accountingExchangeRates = pgTable(
  "accounting_exchange_rates",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    fromCurrency: isoCode("from_currency").notNull(),
    toCurrency: isoCode("to_currency").notNull(),
    rateDate: varchar("rate_date", { length: 10 }).notNull(),
    rateType: varchar("rate_type", { length: 16 }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    source: varchar("source", { length: 40 }).notNull().default("manual"),
    overrideReason: text("override_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    uniqueIndex("accounting_exchange_rates_key_uidx").on(
      table.workspaceSubdomain,
      table.fromCurrency,
      table.toCurrency,
      table.rateDate,
      table.rateType,
    ),
    index("accounting_exchange_rates_lookup_idx").on(
      table.workspaceSubdomain,
      table.fromCurrency,
      table.toCurrency,
      table.rateType,
      desc(table.rateDate),
    ),
    check("accounting_exchange_rates_positive", sql`${table.rate} > 0`),
    check("accounting_exchange_rates_distinct", sql`${table.fromCurrency} <> ${table.toCurrency}`),
  ],
);

/** Platform-wide rates written by the scheduled feed (no tenant, read-only to tenants). */
export const fxReferenceRates = pgTable(
  "fx_reference_rates",
  {
    provider: varchar("provider", { length: 40 }).notNull(),
    baseCurrency: isoCode("base_currency").notNull(),
    quoteCurrency: isoCode("quote_currency").notNull(),
    rateDate: varchar("rate_date", { length: 10 }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.baseCurrency, table.quoteCurrency, table.rateDate],
    }),
    index("fx_reference_rates_lookup_idx").on(
      table.baseCurrency,
      table.quoteCurrency,
      desc(table.rateDate),
    ),
    check("fx_reference_rates_positive", sql`${table.rate} > 0`),
  ],
);
