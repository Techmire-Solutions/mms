import type { TaskNotifyPayload } from "./outboxEventService.js";
import { getTenantTaskSettingsBySubdomain } from "./taskSettingsService.js";
import { notificationsUseCases } from "../notifications/use-cases/notificationsUseCases.js";
import { usersUseCases } from "../users/use-cases/usersUseCases.js";
import { sendTenantEmail } from "./email/emailService.js";

/**
 * Delivers a task notification intent to the configured channel(s) (M4).
 *
 * - `in_app` inserts a user-targeted `tenant_notifications` row per recipient.
 * - `messaging`/`both` sends a plain-text email to each recipient's login email
 *   (SMS/WhatsApp follow-up requires contact-phone resolution through the
 *   faculty/employment link).
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
    const emails = await usersUseCases.loadUserEmailsByTenant(tenant, recipientIds);
    if (emails.length > 0) {
      const body = composeTaskMessage(payload);
      const subject = payload.reason === "assignment" ? "New task assigned" : "Task status updated";
      for (const email of emails) {
        await sendTenantEmail({ to: email, subject, text: body });
      }
    }
  }
}

function composeTaskMessage(payload: TaskNotifyPayload): string {
  const title = payload.title?.trim() || "Untitled task";
  if (payload.reason === "assignment") return `You were assigned a task: ${title}`;
  const status = payload.status ?? "";
  return `Task "${title}" status changed to ${status}.`;
}
