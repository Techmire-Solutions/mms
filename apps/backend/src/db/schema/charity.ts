import {
  pgTable,
  text,
  timestamp,
  numeric,
  varchar,
  date,
  boolean,
  primaryKey,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";
import { contacts, tenantUsers } from "./contacts.js";

export const charityFidyaRecords = pgTable(
  "charity_fidya_records",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    donorName: text("donor_name").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    purpose: text("purpose"),
    distributionStatus: varchar("distribution_status", { length: 30 })
      .default("received")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("charity_fidya_workspace_status_idx").on(
      table.workspaceSubdomain,
      table.distributionStatus,
    ),
  ],
);

export const orphanProfiles = pgTable(
  "orphan_profiles",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dateOfBirth: date("date_of_birth"),
    gender: varchar("gender", { length: 10 }),
    sponsorContactId: text("sponsor_contact_id"),
    monthlyAllowance: numeric("monthly_allowance", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.sponsorContactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("set null"),
    index("orphan_profiles_workspace_sponsor_idx").on(
      table.workspaceSubdomain,
      table.sponsorContactId,
    ),
  ],
);

export const fatwaTickets = pgTable(
  "fatwa_tickets",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    inquirerName: text("inquirer_name").notNull(),
    inquirerContact: text("inquirer_contact"),
    questionText: text("question_text").notNull(),
    answerText: text("answer_text"),
    assignedMuftiId: text("assigned_mufti_id"),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending' | 'answered' | 'closed'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.assignedMuftiId],
      foreignColumns: [tenantUsers.workspaceSubdomain, tenantUsers.id],
    }).onDelete("set null"),
    index("fatwa_tickets_workspace_mufti_idx").on(table.workspaceSubdomain, table.assignedMuftiId),
  ],
);

export const fundraisingCampaigns = pgTable(
  "fundraising_campaigns",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    campaignName: text("campaign_name").notNull(),
    targetAmount: numeric("target_amount", { precision: 15, scale: 2 }),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("fundraising_campaigns_workspace_status_idx").on(table.workspaceSubdomain, table.status),
  ],
);

export const fundraisingCoupons = pgTable(
  "fundraising_coupons",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    campaignId: text("campaign_id").notNull(),
    buyerName: text("buyer_name"),
    buyerContact: text("buyer_contact"),
    price: numeric("price", { precision: 15, scale: 2 }).notNull(),
    isWinner: boolean("is_winner").default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.campaignId],
      foreignColumns: [fundraisingCampaigns.workspaceSubdomain, fundraisingCampaigns.id],
    }).onDelete("cascade"),
    index("fundraising_coupons_workspace_campaign_idx").on(
      table.workspaceSubdomain,
      table.campaignId,
    ),
  ],
);

export const esaleSawabRequests = pgTable(
  "esale_sawab_requests",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    requestorName: text("requestor_name").notNull(),
    deceasedName: text("deceased_name").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain, table.id] })],
);

export type CharityFidyaRecord = typeof charityFidyaRecords.$inferSelect;
export type NewCharityFidyaRecord = typeof charityFidyaRecords.$inferInsert;
export type OrphanProfile = typeof orphanProfiles.$inferSelect;
export type NewOrphanProfile = typeof orphanProfiles.$inferInsert;
export type FatwaTicket = typeof fatwaTickets.$inferSelect;
export type NewFatwaTicket = typeof fatwaTickets.$inferInsert;
export type FundraisingCampaign = typeof fundraisingCampaigns.$inferSelect;
export type NewFundraisingCampaign = typeof fundraisingCampaigns.$inferInsert;
export type FundraisingCoupon = typeof fundraisingCoupons.$inferSelect;
export type NewFundraisingCoupon = typeof fundraisingCoupons.$inferInsert;
export type EsaleSawabRequest = typeof esaleSawabRequests.$inferSelect;
export type NewEsaleSawabRequest = typeof esaleSawabRequests.$inferInsert;
