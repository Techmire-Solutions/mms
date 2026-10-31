import { ALL_PERMISSIONS, roleHasPermission, type User } from "@mms/shared";
import type {
  NewTenantNotification,
  NotificationsRepository,
} from "../repository/notificationsRepository.js";
import { notificationsRepository } from "../repository/notificationsRepositoryAdapter.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { logger } from "../../lib/logger.js";
import { NotFoundError } from "../../lib/httpErrors.js";

/** Live-push key the frontend refetches stored notifications on. */
export const NOTIFICATIONS_BROADCAST_KEY = "notifications";

/** Permissions the user's role holds; a notification is visible when its audience is one of them. */
function permissionsOf(user: User): string[] {
  return ALL_PERMISSIONS.filter((permission) => roleHasPermission(user.role, permission));
}

export function createNotificationsUseCases(
  repo: NotificationsRepository = notificationsRepository,
) {
  return {
    /**
     * Stores a notification for everyone holding `audiencePermission` and pushes a refresh.
     * Never throws: notifying is a side effect of an operation that has already succeeded.
     */
    notify: async (tenant: string, notification: Omit<NewTenantNotification, "id">) => {
      try {
        await repo.insertTenantNotification(tenant, { id: crypto.randomUUID(), ...notification });
        broadcastTenantUpdate(tenant, "collection", NOTIFICATIONS_BROADCAST_KEY);
      } catch (error) {
        logger.warn({ err: error, kind: notification.kind }, "storing a notification failed");
      }
    },

    list: (tenant: string, user: User) =>
      repo.listTenantNotifications(tenant, String(user.id), permissionsOf(user)),

    markRead: async (tenant: string, user: User, id: string) => {
      const found = await repo.markTenantNotificationRead(
        tenant,
        id,
        String(user.id),
        permissionsOf(user),
      );
      if (!found) throw new NotFoundError("Notification not found");
    },

    markAllRead: (tenant: string, user: User) =>
      repo.markAllTenantNotificationsRead(tenant, String(user.id), permissionsOf(user)),
  };
}

export const notificationsUseCases = createNotificationsUseCases();
