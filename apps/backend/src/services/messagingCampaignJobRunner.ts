import type { MessageCategory } from "@mms/shared";
import { personalizeMessage } from "@mms/shared";
import {
  registerBackgroundJobRunner,
  type BackgroundJobRunContext,
} from "./backgroundJobWorkerService.js";
import { sendTenantSms } from "./sms/smsService.js";
import { sendTenantWhatsApp } from "./whatsapp/whatsappService.js";
import { sendTenantEmail } from "./email/emailService.js";
import { messagingUseCases } from "../messaging/use-cases/messagingUseCases.js";
import { buildMessageLogClaimId } from "../lib/messageLogClaimId.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { broadcastCollection } from "../lib/livePush.js";
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
      let skippedCount = 0;
      let claimedCount = 0;

      await runWithTenant(ctx.tenant, async () => {
        for (let i = 0; i < recipients.length; i++) {
          if (ctx.signal?.aborted) {
            logger.warn({ jobId: ctx.jobId }, "Messaging campaign aborted by signal");
            break;
          }

          const recipient = recipients[i];
          const personalizedBody = personalizeMessage(message, recipient);
          const personalizedSubject = subject ? personalizeMessage(subject, recipient) : undefined;
          const claimId = buildMessageLogClaimId(ctx.jobId, recipient.id, channel);

          // Claim before sending: a BullMQ retry re-runs the same runner from
          // recipient 0, and rows already claimed by the previous attempt must
          // not be sent again.
          const claimed = await messagingUseCases.claimMessageLogForDelivery(ctx.tenant, {
            id: claimId,
            userId: ctx.userId,
            contactId: recipient.id,
            channel,
            body: personalizedBody,
            sentAt,
            subject: personalizedSubject,
            category: category ?? "general",
          });
          if (!claimed) {
            skippedCount++;
            continue;
          }
          claimedCount++;

          let sent = false;
          let failureMessage: string | undefined;
          try {
            if (channel === "sms") {
              const res = await sendTenantSms({
                to: recipient.phone ?? "",
                body: personalizedBody,
              });
              sent = res.sent;
              failureMessage = res.message || res.reason;
            } else if (channel === "whatsapp") {
              const res = await sendTenantWhatsApp({
                to: recipient.phone ?? "",
                body: personalizedBody,
              });
              sent = res.sent;
              failureMessage = res.message || res.reason;
            } else if (channel === "email") {
              const res = await sendTenantEmail({
                to: recipient.email ?? "",
                subject: personalizedSubject || "Notification",
                text: personalizedBody,
              });
              sent = res.sent;
              failureMessage = res.message || res.reason;
            }
          } catch (err) {
            failureMessage = err instanceof Error ? err.message : "Dispatch error";
          }

          if (sent) {
            sentCount++;
          } else {
            failedCount++;
          }
          try {
            await messagingUseCases.updateMessageLogDeliveryStatus(
              ctx.tenant,
              claimId,
              sent ? "sent" : "failed",
              sent ? null : failureMessage || "Gateway rejected dispatch",
            );
          } catch (updateErr) {
            logger.error(
              { err: updateErr, jobId: ctx.jobId, claimId },
              "Failed to persist messaging delivery outcome",
            );
          }

          if ((i + 1) % 5 === 0 || i + 1 === recipients.length) {
            await ctx.updateProgress(i + 1, recipients.length);
          }

          // Small throttle delay to prevent carrier gateway 429s
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Do not report success for an aborted run: the sandbox timeout path is
        // about to reject and BullMQ will retry this job.
        throwIfBackgroundJobAborted(ctx.signal);

        if (claimedCount > 0) {
          await broadcastCollection("message_logs");
        }

        const skippedLabel = skippedCount > 0 ? `, ${skippedCount} skipped` : "";
        await ctx.complete({
          label: `Campaign finished: ${sentCount} sent, ${failedCount} failed (${recipients.length} total${skippedLabel})`,
        });
      });
    },
  );
}
