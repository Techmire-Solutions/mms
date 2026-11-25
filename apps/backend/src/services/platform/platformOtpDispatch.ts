import { resolvePlatformNotificationChannel } from "@mms/contracts";
import { logger } from "../../lib/logger.js";
import { dispatchPlatformOtp, type PlatformOtpDispatchResult } from "./platformOtpService.js";
import { sendPlatformSms } from "./platformSmsService.js";
import { getPlatformSettings } from "./platformSettingsService.js";

/**
 * Shared platform OTP dispatch-channel fallback (mms-dry §2).
 *
 * Platform 2FA and platform password reset used to each carry a copy of this
 * block: SMS when the resolved channel allows it and the admin has a phone on
 * file, then email as the fallback (and for the `none` channel, which still
 * emails so local/dev flows stay usable). Callers only supply the per-flow
 * copy (body/subject/log label).
 */
export interface DispatchPlatformOtpAcrossChannelsInput {
  email: string;
  /** Admin phone; SMS is skipped when absent. */
  phone?: string | null;
  code: string;
  ttlMinutes: number;
  /** Log label for OTP email dispatch warnings. */
  logLabel: string;
  /** Full SMS body (flow-specific wording). */
  smsBody: string;
  /** Pino warn message when the SMS leg fails (flow-specific wording). */
  smsFailWarnMessage: string;
  /** Email subject (flow-specific wording). */
  emailSubject: string;
  /** Email body lines (flow-specific wording). */
  emailBodyLines: string[];
  /** Optional log label for the SMS-failure warning (2FA includes one). */
  smsFailLogLabel?: string;
}

export async function dispatchPlatformOtpAcrossChannels(
  input: DispatchPlatformOtpAcrossChannelsInput,
): Promise<PlatformOtpDispatchResult> {
  const channel = resolvePlatformNotificationChannel(getPlatformSettings());
  let smsResult: { sent: boolean; reason?: string } = { sent: false };
  let emailResult: PlatformOtpDispatchResult = { sent: false };

  if ((channel === "both" || channel === "sms") && input.phone) {
    smsResult = await sendPlatformSms({
      to: input.phone,
      body: input.smsBody,
    });
    if (!smsResult.sent) {
      logger.warn(
        {
          channel,
          reason: smsResult.reason,
          ...(input.smsFailLogLabel ? { label: input.smsFailLogLabel } : {}),
        },
        input.smsFailWarnMessage,
      );
    }
  }

  if (
    channel === "both" ||
    channel === "email" ||
    (channel === "sms" && !smsResult.sent) ||
    channel === "none"
  ) {
    emailResult = await dispatchPlatformOtp({
      email: input.email,
      code: input.code,
      subject: input.emailSubject,
      bodyLines: input.emailBodyLines,
      ttlMinutes: input.ttlMinutes,
      logLabel: input.logLabel,
    });
  }

  return {
    sent: smsResult.sent || emailResult.sent,
    devCode: emailResult.devCode,
  };
}
