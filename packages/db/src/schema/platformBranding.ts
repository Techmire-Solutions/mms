import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { DEFAULT_BRANDING_SETTINGS, type BrandingSocialLink } from "@mms/contracts";

/**
 * Platform console branding — singleton row (`id = 'global'`), mirrors tenant
 * `workspaces.branding` columns but names the product rather than a madrasa.
 * Global (not RLS-scoped) like every other `platform_*` table.
 */
export const platformBranding = pgTable("platform_branding", {
  id: text("id").primaryKey().default("global"),
  productName: varchar("product_name", { length: 60 }).notNull().default(""),
  consoleTitle: varchar("console_title", { length: 60 }).notNull().default(""),
  tagline: varchar("tagline", { length: 120 }).notNull().default(""),
  primaryColor: varchar("primary_color", { length: 16 })
    .notNull()
    .default(DEFAULT_BRANDING_SETTINGS.primaryColor),
  secondaryColor: varchar("secondary_color", { length: 16 })
    .notNull()
    .default(DEFAULT_BRANDING_SETTINGS.secondaryColor),
  cornerStyle: varchar("corner_style", { length: 32 }).notNull().default("rounded"),
  logoUrl: text("logo_url").notNull().default(""),
  faviconUrl: text("favicon_url").notNull().default(""),
  footerText: varchar("footer_text", { length: 120 }).notNull().default(""),
  email: varchar("email", { length: 255 }).notNull().default(""),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  website: varchar("website", { length: 255 }).notNull().default(""),
  legalName: varchar("legal_name", { length: 60 }).notNull().default(""),
  registrationNumber: varchar("registration_number", { length: 80 }).notNull().default(""),
  addressLine1: varchar("address_line_1", { length: 200 }).notNull().default(""),
  addressLine2: varchar("address_line_2", { length: 200 }).notNull().default(""),
  city: varchar("city", { length: 100 }).notNull().default(""),
  region: varchar("region", { length: 100 }).notNull().default(""),
  postalCode: varchar("postal_code", { length: 40 }).notNull().default(""),
  country: varchar("country", { length: 100 }).notNull().default(""),
  socialLinks: jsonb("social_links")
    .$type<BrandingSocialLink[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type PlatformBrandingRow = typeof platformBranding.$inferSelect;
export type InsertPlatformBrandingRow = typeof platformBranding.$inferInsert;
