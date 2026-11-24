import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const PLATFORM_MESSAGE_CHANNELS = ["sms", "whatsapp", "email"] as const;
export type PlatformMessageChannel = (typeof PLATFORM_MESSAGE_CHANNELS)[number];

export const PLATFORM_MESSAGE_STATUSES = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
] as const;
export type PlatformMessageStatus = (typeof PLATFORM_MESSAGE_STATUSES)[number];

export interface PlatformMessageRecipient {
  contactId: string;
  name: string;
  channel: PlatformMessageChannel;
  address: string;
}

/**
 * Platform-level broadcast messages (announcements to platform contacts).
 * Not tenant-scoped: access is gated by platform permissions.
 */
export const platformMessages = pgTable(
  "platform_messages",
  {
    id: text("id").primaryKey(),
    channel: varchar("channel", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 200 }),
    body: text("body").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    recipientSnapshot: jsonb("recipient_snapshot")
      .$type<PlatformMessageRecipient[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("platform_messages_channel_idx").on(table.channel),
    index("platform_messages_status_idx").on(table.status),
    index("platform_messages_created_idx").on(table.createdAt),
  ],
);

/** Message templates for the platform Messaging → Setup tier. */
export const platformMessageTemplates = pgTable(
  "platform_message_templates",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    channel: varchar("channel", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 200 }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("platform_message_templates_channel_idx").on(table.channel)],
);
