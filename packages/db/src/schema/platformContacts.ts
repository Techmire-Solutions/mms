import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Platform-wide contact kinds (broadcast audience). */
export const PLATFORM_CONTACT_KINDS = ["platform_operator", "workspace_admin", "external"] as const;
export type PlatformContactKind = (typeof PLATFORM_CONTACT_KINDS)[number];

export interface PlatformContactTag {
  id: string;
  label: string;
}

/**
 * Platform-level contact directory (platform operators + workspace admins +
 * external contacts). Not tenant-scoped: access is gated by platform permissions.
 */
export const platformContacts = pgTable(
  "platform_contacts",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    kind: varchar("kind", { length: 32 }).notNull(),
    workspaceId: text("workspace_id"),
    tags: jsonb("tags")
      .$type<PlatformContactTag[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("platform_contacts_kind_idx").on(table.kind),
    index("platform_contacts_workspace_idx").on(table.workspaceId),
  ],
);
