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
import type { MessageLogDeliveryOutcome } from "../messaging/repository/messagingRepository.js";

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

/** Delivery outcomes persisted per write (one INSERT…ON CONFLICT statement). */
export const MESSAGING_OUTCOME_BATCH_SIZE = 50;

/** Progress ticks; finer than this writes a job row per few recipients. */
export const MESSAGING_PROGRESS_INTERVAL = 20;

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

      let sentCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let claimedCount = 0;
      const pendingOutcomes: MessageLogDeliveryOutcome[] = [];

      /** Batch-writes buffered outcomes; a failed write is logged, never thrown. */
      const flushOutcomes = async (): Promise<void> => {
        if (pendingOutcomes.length === 0) return;
        const batch = pendingOutcomes.splice(0, pendingOutcomes.length);
        try {
          await messagingUseCases.saveMessageLogDeliveryOutcomes(ctx.tenant, batch);
        } catch (err) {
          logger.error(
            { err, jobId: ctx.jobId, count: batch.length },
            "Failed to persist messaging delivery outcomes",
          );
        }
      };

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
          // Per-recipient send timestamp: a 500-recipient campaign runs for
          // minutes, so one job-level timestamp would misdate the tail rows.
          const sentAt = new Date().toISOString();
          const claim = {
            id: claimId,
            userId: ctx.userId,
            contactId: recipient.id,
            channel,
            body: personalizedBody,
            sentAt,
            subject: personalizedSubject,
            category: category ?? "general",
          };

          // Claim before sending: a BullMQ retry re-runs the same runner from
          // recipient 0, and rows already claimed by the previous attempt must
          // not be sent again.
          const claimed = await messagingUseCases.claimMessageLogForDelivery(ctx.tenant, claim);
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
            } else {
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
          pendingOutcomes.push({
            ...claim,
            status: sent ? "sent" : "failed",
            errorMessage: sent ? null : failureMessage || "Gateway rejected dispatch",
          });
          if (pendingOutcomes.length >= MESSAGING_OUTCOME_BATCH_SIZE) {
            await flushOutcomes();
          }

          if ((i + 1) % MESSAGING_PROGRESS_INTERVAL === 0 || i + 1 === recipients.length) {
            await ctx.updateProgress(i + 1, recipients.length);
          }

          // Small throttle delay to prevent carrier gateway 429s
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Persist the tail before the abort guard: the outcomes are already
        // delivered, so losing them would misreport the campaign.
        await flushOutcomes();

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
