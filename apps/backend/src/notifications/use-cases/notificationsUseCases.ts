import { ALL_PERMISSIONS, type User } from "@mms/shared";
import type {
  NewTenantNotification,
  NotificationsRepository,
} from "../repository/notificationsRepository.js";
import { notificationsRepository } from "../repository/notificationsRepositoryAdapter.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { logger } from "../../lib/logger.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { userHasPermission } from "../../lib/userPermissionContext.js";

/** Live-push key the frontend refetches stored notifications on. */
export const NOTIFICATIONS_BROADCAST_KEY = "notifications";

/** Permissions the user's role holds; a notification is visible when its audience is one of them. */
function permissionsOf(user: User): string[] {
  return ALL_PERMISSIONS.filter((permission) => userHasPermission(user, permission));
}

export function createNotificationsUseCases(
  repo: NotificationsRepository = notificationsRepository,
) {
  return {
    /**
     * Stores a notification for everyone holding `audiencePermission` and pushes a refresh.
     *
     * Never throws (notifying is a side effect of an operation that already succeeded) but reports
     * whether the row is now stored: `true` when inserted **or already present for its dedupe key**,
     * `false` when the insert failed. Callers that stamp a "notified" marker must only do so on
     * `true`, otherwise a transient failure would silence the alert forever.
     */
    notify: async (
      tenant: string,
      notification: Omit<NewTenantNotification, "id">,
    ): Promise<boolean> => {
      try {
        const stored = await repo.insertTenantNotification(tenant, {
          id: crypto.randomUUID(),
          ...notification,
        });
        if (stored) broadcastTenantUpdate(tenant, "collection", NOTIFICATIONS_BROADCAST_KEY);
        return true;
      } catch (error) {
        logger.warn({ err: error, kind: notification.kind }, "storing a notification failed");
        return false;
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
