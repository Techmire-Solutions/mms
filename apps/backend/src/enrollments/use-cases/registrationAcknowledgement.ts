import type { RegistrationApplicationStatus } from "@mms/shared";
import { logger } from "../../lib/logger.js";
import { sendTenantSms } from "../../services/sms/smsService.js";

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

/**
 * Texts the applicant their reference number after a public submission.
 *
 * Delivery rides on the tenant's own SMS provider and `sendTenantSms` already returns
 * `notifications_disabled` when the workspace has not enabled SMS notifications, so a workspace
 * that never configured SMS sends nothing and pays nothing. Never throws and never blocks: the
 * application is already stored by the time this runs, and a failed text must not fail the
 * submission.
 */
export async function sendRegistrationAcknowledgement(input: {
  phone: string;
  reference: string;
  status: RegistrationApplicationStatus;
  workspaceName: string;
}): Promise<void> {
  if (!input.phone.trim() || !isAcknowledgeable(input.status)) return;
  try {
    const result = await sendTenantSms({
      to: input.phone,
      body: body(input.status, input.reference, input.workspaceName),
    });
    if (!result.sent && result.reason !== "notifications_disabled") {
      logger.warn(
        { reference: input.reference, reason: result.reason },
        "registration acknowledgement SMS failed",
      );
    }
  } catch (error) {
    logger.warn({ err: error, reference: input.reference }, "registration acknowledgement failed");
  }
}
