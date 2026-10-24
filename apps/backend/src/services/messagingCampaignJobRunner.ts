import { randomUUID } from "node:crypto";
import type { Message, MessageCategory } from "@mms/shared";
import { personalizeMessage } from "@mms/shared";
import {
  registerBackgroundJobRunner,
  type BackgroundJobRunContext,
} from "./backgroundJobWorkerService.js";
import { sendTenantSms } from "./sms/smsService.js";
import { sendTenantWhatsApp } from "./whatsapp/whatsappService.js";
import { sendTenantEmail } from "./email/emailService.js";
import { messagingUseCases } from "../messaging/use-cases/messagingUseCases.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { logger } from "../lib/logger.js";

export interface MessagingDispatchJobPayload {
  channel: "sms" | "whatsapp" | "email";
  recipients: Array<{
    id: string;
    name?: string;
    phone?: string;
    email?: string;
  }>;
  message: string;
  subject?: string;
  category?: MessageCategory;
}

export function registerMessagingCampaignJobRunner(): void {
  registerBackgroundJobRunner(
    "messaging:dispatch",
    async (rawPayload, ctx: BackgroundJobRunContext) => {
      const payload = rawPayload as MessagingDispatchJobPayload;
      const { channel, recipients, message, subject, category } = payload;
      if (!recipients || recipients.length === 0) {
        await ctx.complete({ label: "Messaging campaign completed (0 recipients)" });
        return;
      }

      const sentAt = new Date().toISOString();
      let sentCount = 0;
      let failedCount = 0;
      const logs: Message[] = [];

      await runWithTenant(ctx.tenant, async () => {
        for (let i = 0; i < recipients.length; i++) {
          if (ctx.signal?.aborted) {
            logger.warn({ jobId: ctx.jobId }, "Messaging campaign aborted by signal");
            break;
          }

          const recipient = recipients[i];
          const personalizedBody = personalizeMessage(message, recipient);
          const personalizedSubject = subject ? personalizeMessage(subject, recipient) : undefined;

          try {
            let sent = false;
            let errorMessage: string | undefined;

            if (channel === "sms") {
              const res = await sendTenantSms({
                to: recipient.phone ?? "",
                body: personalizedBody,
              });
              sent = res.sent;
              errorMessage = res.message || res.reason;
            } else if (channel === "whatsapp") {
              const res = await sendTenantWhatsApp({
                to: recipient.phone ?? "",
                body: personalizedBody,
              });
              sent = res.sent;
              errorMessage = res.message || res.reason;
            } else if (channel === "email") {
              const res = await sendTenantEmail({
                to: recipient.email ?? "",
                subject: personalizedSubject || "Notification",
                text: personalizedBody,
              });
              sent = res.sent;
              errorMessage = res.message || res.reason;
            }

            if (sent) {
              sentCount++;
              logs.push({
                id: randomUUID(),
                userId: ctx.userId,
                contactId: recipient.id,
                channel,
                body: personalizedBody,
                subject: personalizedSubject,
                sentAt,
                status: "sent",
                category: category || "general",
              });
            } else {
              failedCount++;
              logs.push({
                id: randomUUID(),
                userId: ctx.userId,
                contactId: recipient.id,
                channel,
                body: personalizedBody,
                subject: personalizedSubject,
                sentAt,
                status: "failed",
                category: category || "general",
                errorMessage: errorMessage || "Gateway rejected dispatch",
              });
            }
          } catch (err) {
            failedCount++;
            logs.push({
              id: randomUUID(),
              userId: ctx.userId,
              contactId: recipient.id,
              channel,
              body: personalizedBody,
              subject: personalizedSubject,
              sentAt,
              status: "failed",
              category: category || "general",
              errorMessage: err instanceof Error ? err.message : "Dispatch error",
            });
          }

          if ((i + 1) % 5 === 0 || i + 1 === recipients.length) {
            await ctx.updateProgress(i + 1, recipients.length);
          }

          // Small throttle delay to prevent carrier gateway 429s
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        if (logs.length > 0) {
          try {
            await messagingUseCases.recordMessageLogs(ctx.tenant, logs);
          } catch (err) {
            logger.error({ err }, "Failed to record message logs for background campaign");
          }
        }

        await ctx.complete({
          label: `Campaign finished: ${sentCount} sent, ${failedCount} failed (${recipients.length} total)`,
        });
      });
    },
  );
}
