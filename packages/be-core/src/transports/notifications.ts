import { broadcastLocalJobEvent } from "../realtime/jobEvents.js";

export interface NotificationMessage {
  tenantId: string;
  userId?: string;
  /** Stable channel-level event name (e.g. `notification`, `job:complete`). */
  event: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface NotificationDelivery {
  delivered: boolean;
  error?: string;
}

export interface NotificationChannel {
  readonly id: string;
  send(message: NotificationMessage): Promise<NotificationDelivery>;
}

/**
 * In-app channel: pushes a realtime event to connected tenant sockets. The
 * underlying emitter is injectable so tests and future transports can replace it.
 */
export function createRealtimeNotificationChannel(options?: {
  emit?: (event: {
    event: string;
    tenantId: string;
    userId?: string;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    jobId?: string;
    label?: string;
    error?: string;
  }) => void;
}): NotificationChannel {
  const emit =
    options?.emit ??
    ((event) =>
      broadcastLocalJobEvent({
        event: event.event,
        tenantId: event.tenantId,
        userId: event.userId,
        jobId: event.jobId ?? String(event.data?.jobId ?? event.event),
        label: event.label,
        error: event.error,
      }));
  return {
    id: "in-app",
    async send(message) {
      try {
        emit({
          event: message.event,
          tenantId: message.tenantId,
          userId: message.userId,
          jobId: String(message.data?.jobId ?? message.event),
          label: message.title,
          error: message.body,
        });
        return { delivered: true };
      } catch (error) {
        return { delivered: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

export interface EmailNotificationPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailNotificationSender = (
  payload: EmailNotificationPayload,
) => Promise<{ sent: boolean; message?: string }>;

/**
 * Email channel adapter over an injected send function (SMTP transport or a
 * platform-specific mailer). Notification templates stay with their owning app
 * service; this adapter only maps delivery outcomes.
 */
export function createEmailNotificationChannel(options: {
  send: EmailNotificationSender;
  id?: string;
}): NotificationChannel & {
  sendEmail(payload: EmailNotificationPayload): Promise<NotificationDelivery>;
} {
  return {
    id: options.id ?? "email",
    async sendEmail(payload) {
      try {
        const outcome = await options.send(payload);
        return outcome.sent ? { delivered: true } : { delivered: false, error: outcome.message };
      } catch (error) {
        return { delivered: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    async send(_message) {
      return { delivered: false, error: "email channel requires sendEmail(payload)" };
    },
  };
}
