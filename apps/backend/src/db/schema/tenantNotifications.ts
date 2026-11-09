import {
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

/** Stored in-app notifications, addressed to a permission audience (migration 0196). */
export const tenantNotifications = pgTable(
  "tenant_notifications",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(),
    audiencePermission: varchar("audience_permission", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: text("entity_id").notNull(),
    subjectLabel: text("subject_label").notNull(),
    contextLabel: text("context_label").notNull().default(""),
    /**
     * Optional producer-supplied idempotency key (migration 0223).
     *
     * A retried or concurrent producer that passes the same key stores at most one row, which is what
     * makes the absence scan's notifications exactly-once across crashes and double runs.
     */
    dedupeKey: varchar("dedupe_key", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: "tenant_notifications_pk", columns: [table.workspaceSubdomain, table.id] }),
    index("tenant_notifications_workspace_created_idx").on(
      table.workspaceSubdomain,
      sql`${table.createdAt} DESC`,
    ),
    uniqueIndex("tenant_notifications_workspace_dedupe_uidx")
      .on(table.workspaceSubdomain, table.dedupeKey)
      .where(sql`${table.dedupeKey} IS NOT NULL`),
  ],
);

/** Per-user read receipts for {@link tenantNotifications}. */
export const tenantNotificationReads = pgTable(
  "tenant_notification_reads",
  {
    workspaceSubdomain: text("workspace_subdomain").notNull(),
    notificationId: text("notification_id").notNull(),
    userId: text("user_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "tenant_notification_reads_pk",
      columns: [table.workspaceSubdomain, table.notificationId, table.userId],
    }),
    foreignKey({
      name: "tenant_notification_reads_notification_fk",
      columns: [table.workspaceSubdomain, table.notificationId],
      foreignColumns: [tenantNotifications.workspaceSubdomain, tenantNotifications.id],
    }).onDelete("cascade"),
    index("tenant_notification_reads_user_idx").on(table.workspaceSubdomain, table.userId),
  ],
);
