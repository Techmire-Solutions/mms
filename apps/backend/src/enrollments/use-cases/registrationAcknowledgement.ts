import type { RegistrationApplicationStatus } from "@mms/shared";
import { logger } from "../../lib/logger.js";
import { sendTenantSms } from "../../services/sms/smsService.js";
import { sendTenantWhatsApp } from "../../services/whatsapp/whatsappService.js";

/** The three outcomes a public submission can land on; the rest are staff-side transitions. */
type AcknowledgeableStatus = Extract<
  RegistrationApplicationStatus,
  "submitted" | "waitlisted" | "approved"
>;

function body(status: AcknowledgeableStatus, reference: string, workspace: string): string {
  const prefix = `${workspace}: application ${reference}`;
  if (status === "approved") {
    return `${prefix} is approved. Keep this reference for your records.`;
  }
  if (status === "waitlisted") {
    return `${prefix} is on the waiting list. We will contact you if a place opens.`;
  }
  return `${prefix} has been received and is awaiting review. Keep this reference for your records.`;
}

function isAcknowledgeable(status: RegistrationApplicationStatus): status is AcknowledgeableStatus {
  return status === "submitted" || status === "waitlisted" || status === "approved";
}

type ChannelResult = { sent: boolean; reason?: string };

/** Logs a real delivery failure; a channel the workspace switched off is not an error. */
function report(
  channel: "sms" | "whatsapp",
  reference: string,
  result: PromiseSettledResult<ChannelResult>,
) {
  if (result.status === "rejected") {
    logger.warn({ err: result.reason, reference, channel }, "registration acknowledgement failed");
  } else if (!result.value.sent && result.value.reason !== "notifications_disabled") {
    logger.warn(
      { reference, channel, reason: result.value.reason },
      "registration acknowledgement not delivered",
    );
  }
}

/**
 * Sends the applicant their reference number after a public submission, by SMS and by WhatsApp.
 *
 * Each channel rides on the tenant's own provider and is gated by its own workspace setting
 * (`sendTenantSms` / `sendTenantWhatsApp` return `notifications_disabled` when it is off), so a
 * workspace sends only on the channels it enabled and pays for nothing else. The two are sent
 * independently: one failing never stops the other. Never throws and never blocks — the
 * application is already stored, and a failed message must not fail the submission.
 */
export async function sendRegistrationAcknowledgement(input: {
  phone: string;
  reference: string;
  status: RegistrationApplicationStatus;
  workspaceName: string;
}): Promise<void> {
  if (!input.phone.trim() || !isAcknowledgeable(input.status)) return;
  const message = {
    to: input.phone,
    body: body(input.status, input.reference, input.workspaceName),
  };
  const [sms, whatsapp] = await Promise.allSettled([
    sendTenantSms(message),
    sendTenantWhatsApp(message),
  ]);
  report("sms", input.reference, sms);
  report("whatsapp", input.reference, whatsapp);
}
