import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  TENANT_NOTIFICATION_LIST_LIMIT,
  TENANT_NOTIFICATION_RETENTION_DAYS,
  type TenantNotificationKind,
  type TenantNotificationList,
} from "@mms/shared";
import { tenantNotificationReads, tenantNotifications } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

export interface NewTenantNotification {
  id: string;
  kind: TenantNotificationKind;
  audiencePermission: string;
  entityType: string;
  entityId: string;
  subjectLabel: string;
  contextLabel: string;
}

const since = () => new Date(Date.now() - TENANT_NOTIFICATION_RETENTION_DAYS * 86_400_000);

/** Notifications a user may see: addressed to one of their permissions, inside the retention window. */
function visibleTo(subdomain: string, permissions: string[]) {
  return and(
    eq(tenantNotifications.workspaceSubdomain, subdomain),
    inArray(tenantNotifications.audiencePermission, permissions),
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
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    tx.insert(tenantNotifications).values({ ...notification, workspaceSubdomain: subdomain }),
  );
}

export async function listTenantNotifications(
  tenant: string,
  userId: string,
  permissions: string[],
): Promise<TenantNotificationList> {
  const subdomain = tenant.trim().toLowerCase();
  if (permissions.length === 0) return { notifications: [], unreadCount: 0 };
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
      .where(visibleTo(subdomain, permissions))
      .orderBy(desc(tenantNotifications.createdAt))
      .limit(TENANT_NOTIFICATION_LIST_LIMIT);
    const [unread] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantNotifications)
      .leftJoin(tenantNotificationReads, readJoin(userId))
      .where(and(visibleTo(subdomain, permissions), isNull(tenantNotificationReads.userId)));
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
  if (permissions.length === 0) return false;
  return withTenant(subdomain, async (tx) => {
    const [visible] = await tx
      .select({ id: tenantNotifications.id })
      .from(tenantNotifications)
      .where(and(visibleTo(subdomain, permissions), eq(tenantNotifications.id, id)))
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
  if (permissions.length === 0) return;
  await withTenant(subdomain, async (tx) => {
    const unread = await tx
      .select({ id: tenantNotifications.id })
      .from(tenantNotifications)
      .leftJoin(tenantNotificationReads, readJoin(userId))
      .where(and(visibleTo(subdomain, permissions), isNull(tenantNotificationReads.userId)));
    if (unread.length === 0) return;
    await tx
      .insert(tenantNotificationReads)
      .values(
        unread.map((row) => ({ workspaceSubdomain: subdomain, notificationId: row.id, userId })),
      )
      .onConflictDoNothing();
  });
}
