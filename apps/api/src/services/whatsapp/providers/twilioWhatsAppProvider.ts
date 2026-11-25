import { fetchSafeExternal } from "../../../lib/outboundUrl.js";
import type { WhatsappProviderCredentials, WhatsappSendResult } from "./types.js";

/** Twilio Messaging API for WhatsApp. */
export async function sendTwilioWhatsApp(
  to: string,
  body: string,
  creds: WhatsappProviderCredentials,
): Promise<WhatsappSendResult> {
  const accountSid = creds.accountId.trim();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${creds.accountSecret}`).toString("base64")}`;

  const cleanTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to.trim()}`;
  const cleanFrom = creds.senderId.startsWith("whatsapp:")
    ? creds.senderId.trim()
    : `whatsapp:${creds.senderId.trim()}`;

  const params = new URLSearchParams({
    To: cleanTo,
    From: cleanFrom,
    Body: body,
  });

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
    return {
      success: false,
      error: payload?.message ?? `Twilio WhatsApp responded ${response.status}`,
    };
  }

  return { success: true, providerMessageId: payload?.sid };
}
