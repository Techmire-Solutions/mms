import type { MessageCategory } from "@mms/shared";
import { personalizeMessage } from "@mms/shared";
import { buildMessageLogClaimId } from "../../../lib/messageLogClaimId.js";
import { logger } from "../../../lib/logger.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import { sendTenantSms } from "../../../services/sms/smsService.js";
import { sendTenantWhatsApp } from "../../../services/whatsapp/whatsappService.js";
import { sendTenantEmail } from "../../../services/email/emailService.js";

/** Lean recipient shape shared by the channel dispatch routes. */
export interface DirectDispatchRecipient {
  id: string | number;
  name?: string;
  phone?: string;
  email?: string;
}

export interface DirectDispatchParams {
  tenantSubdomain: string;
  userId: string;
  /** Claim scope — the idempotency key when supplied, else a per-request id. */
  dispatchId: string;
  channel: "sms" | "whatsapp" | "email";
  recipients: readonly DirectDispatchRecipient[];
  message: string;
  sentAt: string;
  category: MessageCategory;
  subject?: string;
  html?: string;
}

export interface DirectDispatchSummary {
  sentCount: number;
  failedCount: number;
  /** Recipients already claimed by an earlier attempt of the same dispatch. */
  skippedCount: number;
  total: number;
}

interface SendOutcome {
  sent: boolean;
  failureMessage?: string;
}

async function sendDirectChannel(
  channel: DirectDispatchParams["channel"],
  recipient: DirectDispatchRecipient,
  body: string,
  subject: string | undefined,
  html: string | undefined,
): Promise<SendOutcome> {
  try {
    if (channel === "sms") {
      const res = await sendTenantSms({ to: recipient.phone ?? "", body });
      return { sent: res.sent, failureMessage: res.message || res.reason };
    }
    if (channel === "whatsapp") {
      const res = await sendTenantWhatsApp({ to: recipient.phone ?? "", body });
      return { sent: res.sent, failureMessage: res.message || res.reason };
    }
    const res = await sendTenantEmail({
      to: recipient.email ?? "",
      subject: subject || "Notification",
      text: body,
      html,
    });
    return { sent: res.sent, failureMessage: res.message || res.reason };
  } catch (err) {
    return { sent: false, failureMessage: err instanceof Error ? err.message : "Dispatch error" };
  }
}

/**
 * Direct (non-queued) campaign dispatch for ≤50 recipients.
 *
 * Claims each recipient before the provider call — the same send-once pattern the
 * queued runner uses (`services/messagingCampaignJobRunner.ts`) — so a retry of a
 * partially-delivered dispatch skips recipients already attempted instead of
 * re-sending them when a later write fails.
 */
export async function dispatchMessagingCampaignDirect(
  params: DirectDispatchParams,
): Promise<DirectDispatchSummary> {
  const { tenantSubdomain, userId, dispatchId, channel, recipients, category, sentAt } = params;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const recipient of recipients) {
    const personalizedBody = personalizeMessage(params.message, recipient);
    const personalizedSubject = params.subject
      ? personalizeMessage(params.subject, recipient)
      : undefined;
    const personalizedHtml = params.html ? personalizeMessage(params.html, recipient) : undefined;
    const claimId = buildMessageLogClaimId(dispatchId, String(recipient.id), channel);

    const claimed = await messagingUseCases.claimMessageLogForDelivery(tenantSubdomain, {
      id: claimId,
      userId,
      contactId: String(recipient.id),
      channel,
      body: personalizedBody,
      sentAt,
      subject: personalizedSubject,
      category,
    });
    if (!claimed) {
      skippedCount += 1;
      continue;
    }

    const outcome = await sendDirectChannel(
      channel,
      recipient,
      personalizedBody,
      personalizedSubject,
      personalizedHtml,
    );
    if (outcome.sent) sentCount += 1;
    else failedCount += 1;

    try {
      await messagingUseCases.updateMessageLogDeliveryStatus(
        tenantSubdomain,
        claimId,
        outcome.sent ? "sent" : "failed",
        outcome.sent ? null : outcome.failureMessage || "Gateway rejected dispatch",
      );
    } catch (err) {
      // The claim row stays `sending`; the summary still reports the provider
      // outcome and a retry will reclaim it once the stale window elapses.
      logger.error(
        { err, claimId, tenant: tenantSubdomain },
        "Failed to persist messaging delivery outcome",
      );
    }
  }

  return { sentCount, failedCount, skippedCount, total: recipients.length };
}
