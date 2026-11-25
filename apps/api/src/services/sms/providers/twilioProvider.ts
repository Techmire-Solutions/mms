import { fetchSafeExternal } from "../../../lib/outboundUrl.js";
import type { SmsProviderCredentials, SmsSendResult } from "./types.js";

/** https://www.twilio.com/docs/sms/send-messages — Account SID + Auth Token Basic Auth. */
export async function sendTwilioSms(
  to: string,
  body: string,
  creds: SmsProviderCredentials,
): Promise<SmsSendResult> {
  const accountSid = creds.accountId;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${creds.accountSecret}`).toString("base64")}`;

  const params = new URLSearchParams({ To: to, From: creds.senderId, Body: body });

  const response = await fetchSafeExternal(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = (await response.json().catch(() => null)) as {
    sid?: string;
    message?: string;
  } | null;
  if (!response.ok) {
    return { success: false, error: payload?.message ?? `Twilio responded ${response.status}` };
  }
  return { success: true, providerMessageId: payload?.sid };
}
