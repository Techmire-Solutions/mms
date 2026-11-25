import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import {
  TENANT_NOTIFICATION_LIST_LIMIT,
  TENANT_NOTIFICATION_RETENTION_DAYS,
  type TenantNotificationKind,
  type TenantNotificationList,
} from "@mms/contracts";
import { tenantNotificationReads, tenantNotifications } from "@mms/db/schema";
import { withTenant, withTenantRead } from "@mms/db/context";

export interface NewTenantNotification {
  id: string;
  kind: TenantNotificationKind;
  audiencePermission: string;
  entityType: string;
  entityId: string;
  subjectLabel: string;
  contextLabel: string;
  /**
   * Producer idempotency key. Two inserts with the same key in a workspace store one row; the second
   * is a no-op (used by the absence scan, which can retry after a crash).
   */
  dedupeKey?: string | null;
  /** When set, the notification is visible only to this user (task notifications). */
  recipientUserId?: string | null;
}

const since = () => new Date(Date.now() - TENANT_NOTIFICATION_RETENTION_DAYS * 86_400_000);

/** Notifications a user may see: addressed to a permission they hold OR targeted at them, inside the retention window. */
function visibleTo(subdomain: string, userId: string, permissions: string[]) {
  const audience =
    permissions.length > 0
      ? inArray(tenantNotifications.audiencePermission, permissions)
      : sql`false`;
  return and(
    eq(tenantNotifications.workspaceSubdomain, subdomain),
    or(audience, eq(tenantNotifications.recipientUserId, userId)),
    gte(tenantNotifications.createdAt, since()),
  );
}

const readJoin = (userId: string) =>
  and(
    eq(tenantNotificationReads.workspaceSubdomain, tenantNotifications.workspaceSubdomain),
    eq(tenantNotificationReads.notificationId, tenantNotifications.id),
    eq(tenantNotificationReads.userId, userId),
  );

export async function insertTenantNotification(
  tenant: string,
  notification: NewTenantNotification,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const inserted = await tx
      .insert(tenantNotifications)
      .values({
        ...notification,
        dedupeKey: notification.dedupeKey ?? null,
        recipientUserId: notification.recipientUserId ?? null,
        workspaceSubdomain: subdomain,
      })
      // Any unique violation (dedupe key) means "already delivered"; the PK is a random UUID.
      .onConflictDoNothing()
      .returning({ id: tenantNotifications.id });
    return inserted.length > 0;
  });
}

export async function listTenantNotifications(
  tenant: string,
  userId: string,
  permissions: string[],
): Promise<TenantNotificationList> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: tenantNotifications.id,
        kind: tenantNotifications.kind,
        entityType: tenantNotifications.entityType,
        entityId: tenantNotifications.entityId,
        subjectLabel: tenantNotifications.subjectLabel,
        contextLabel: tenantNotifications.contextLabel,
        createdAt: tenantNotifications.createdAt,
        readAt: tenantNotificationReads.readAt,
      })
      .from(tenantNotifications)
      .leftJoin(tenantNotificationReads, readJoin(userId))
      .where(visibleTo(subdomain, userId, permissions))
      .orderBy(desc(tenantNotifications.createdAt))
      .limit(TENANT_NOTIFICATION_LIST_LIMIT);
    const [unread] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantNotifications)
      .leftJoin(tenantNotificationReads, readJoin(userId))
      .where(
        and(visibleTo(subdomain, userId, permissions), isNull(tenantNotificationReads.userId)),
      );
    return {
      notifications: rows.map((row) => ({
        id: row.id,
        kind: row.kind as TenantNotificationKind,
        entityType: row.entityType,
        entityId: row.entityId,
        subjectLabel: row.subjectLabel,
        contextLabel: row.contextLabel,
        createdAt: row.createdAt.toISOString(),
        read: row.readAt !== null,
      })),
      unreadCount: Number(unread?.count ?? 0),
    };
  });
}

/** Marks one visible notification read; false when the user cannot see it. Idempotent. */
export async function markTenantNotificationRead(
  tenant: string,
  id: string,
  userId: string,
  permissions: string[],
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [visible] = await tx
      .select({ id: tenantNotifications.id })
      .from(tenantNotifications)
      .where(and(visibleTo(subdomain, userId, permissions), eq(tenantNotifications.id, id)))
      .limit(1);
    if (!visible) return false;
    await tx
      .insert(tenantNotificationReads)
      .values({ workspaceSubdomain: subdomain, notificationId: id, userId })
      .onConflictDoNothing();
    return true;
  });
}

/** Marks every visible, unread notification read for the user. */
export async function markAllTenantNotificationsRead(
  tenant: string,
  userId: string,
  permissions: string[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const unread = await tx
      .select({ id: tenantNotifications.id })
      .from(tenantNotifications)
      .leftJoin(tenantNotificationReads, readJoin(userId))
      .where(
        and(visibleTo(subdomain, userId, permissions), isNull(tenantNotificationReads.userId)),
      );
    if (unread.length === 0) return;
    await tx
      .insert(tenantNotificationReads)
      .values(
        unread.map((row) => ({ workspaceSubdomain: subdomain, notificationId: row.id, userId })),
      )
      .onConflictDoNothing();
  });
}
