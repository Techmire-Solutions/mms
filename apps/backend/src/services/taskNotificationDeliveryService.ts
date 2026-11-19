import {
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  normalizeMessagingPreferences,
  toMessagingRecipient,
} from "@mms/shared";
import type { TaskNotifyPayload } from "./outboxEventService.js";
import { getTenantTaskSettingsBySubdomain } from "./taskSettingsService.js";
import { notificationsUseCases } from "../notifications/use-cases/notificationsUseCases.js";
import { usersUseCases } from "../users/use-cases/usersUseCases.js";
import { messagingUseCases } from "../messaging/use-cases/messagingUseCases.js";
import { loadContactsSummaryByIdsForTenant } from "./contactService.js";
import { dispatchMessagingCampaignDirect } from "../routes/tenant/messaging/messagingDirectDispatch.js";
import { logger } from "../lib/logger.js";

/**
 * Delivers a task notification intent to the configured channel(s) (M4).
 *
 * - `in_app` inserts a user-targeted `tenant_notifications` row per recipient.
 * - `messaging`/`both` dispatches through the messaging module using the
 *   tenant's default channel (SMS fallback), with email as the fallback for
 *   recipients that have no linked contact phone.
 */
export async function deliverTaskNotification(
  tenant: string,
  payload: TaskNotifyPayload,
): Promise<void> {
  const settings = await getTenantTaskSettingsBySubdomain(tenant);
  if (payload.reason === "assignment" && !settings.notifyOnAssignment) return;
  if (payload.reason === "status_change" && !settings.notifyOnStatusChange) return;

  const channel = settings.notificationChannel;
  const recipientIds = payload.recipientUserIds ?? [];

  if ((channel === "in_app" || channel === "both") && recipientIds.length > 0) {
    const kind = payload.reason === "assignment" ? "task_assigned" : "task_status_changed";
    for (const userId of recipientIds) {
      await notificationsUseCases.notify(tenant, {
        kind,
        audiencePermission: "",
        entityType: "tasks",
        entityId: payload.entityId,
        subjectLabel: payload.title ?? "",
        contextLabel: "",
        recipientUserId: userId,
      });
    }
  }

  if (channel === "messaging" || channel === "both") {
    const recipients = await resolveMessagingRecipients(tenant, recipientIds);
    if (recipients.length === 0) return;

    const prefs = normalizeMessagingPreferences(
      await messagingUseCases.loadMessagingPreferences(tenant),
    );
    const medium: "sms" | "whatsapp" | "email" =
      prefs.defaultChannel === "all" ? "sms" : prefs.defaultChannel;
    const body = composeTaskMessage(payload);
    const subject = payload.reason === "assignment" ? "New task assigned" : "Task status updated";

    try {
      await dispatchMessagingCampaignDirect({
        tenantSubdomain: tenant,
        userId: payload.actorUserId ?? "system",
        dispatchId: `task-${payload.reason}-${payload.entityId}-${payload.version}`,
        channel: medium,
        recipients,
        message: body,
        sentAt: new Date().toISOString(),
        category: "general",
        subject,
      });
    } catch (err) {
      logger.warn(
        { err, tenant, reason: payload.reason, entityId: payload.entityId },
        "[TaskNotify] messaging dispatch failed",
      );
    }
  }
}

/** Resolves recipients to `{ id, name, phone, email }` for the messaging dispatch. */
async function resolveMessagingRecipients(
  tenant: string,
  userIds: string[],
): Promise<Array<{ id: string | number; name?: string; phone?: string; email?: string }>> {
  if (userIds.length === 0) return [];
  const contactIds = await usersUseCases.loadUserContactIdsByTenant(tenant, userIds);
  const contacts = await loadContactsSummaryByIdsForTenant(tenant, [...contactIds.values()]);
  const contactById = new Map(contacts.map((contact) => [String(contact.id), contact]));

  const recipients: Array<{ id: string | number; name?: string; phone?: string; email?: string }> =
    [];
  const withoutContact: string[] = [];
  for (const userId of userIds) {
    const contactId = contactIds.get(userId);
    const contact = contactId ? contactById.get(contactId) : undefined;
    if (contact) {
      const recipient = toMessagingRecipient(contact, {
        getDisplayName,
        getPrimaryPhone,
        getPrimaryEmail,
      });
      recipients.push(recipient);
    } else {
      withoutContact.push(userId);
    }
  }

  if (withoutContact.length > 0) {
    const emails = await usersUseCases.loadUserEmailsByTenant(tenant, withoutContact);
    const byUser = new Map(
      withoutContact.map((userId, index) => [userId, emails[index] ?? undefined]),
    );
    for (const userId of withoutContact) {
      const email = byUser.get(userId);
      if (email) recipients.push({ id: userId, email });
    }
  }

  return recipients;
}

function composeTaskMessage(payload: TaskNotifyPayload): string {
  const title = payload.title?.trim() || "Untitled task";
  if (payload.reason === "assignment") return `You were assigned a task: ${title}`;
  const status = payload.status ?? "";
  return `Task "${title}" status changed to ${status}.`;
}
