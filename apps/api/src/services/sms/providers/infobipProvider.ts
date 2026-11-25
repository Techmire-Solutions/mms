import { fetchSafeExternal, safeExternalHttpUrl } from "../../../lib/outboundUrl.js";
import type { SmsProviderCredentials, SmsSendResult } from "./types.js";

/** https://www.infobip.com/docs/api/channels/sms/sms-messaging/outbound-sms/send-sms-messages */
export async function sendInfobipSms(
  to: string,
  body: string,
  creds: SmsProviderCredentials,
): Promise<SmsSendResult> {
  const rawBase = creds.apiBaseUrl?.trim();
  if (!rawBase) return { success: false, error: "Infobip API base URL is not configured" };

  let baseUrl: string;
  try {
    baseUrl = safeExternalHttpUrl(
      rawBase.startsWith("http") ? rawBase : `https://${rawBase}`,
      "Infobip API base URL",
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid Infobip API base URL",
    };
  }

  const response = await fetchSafeExternal(`${baseUrl}/sms/2/text/advanced`, {
    method: "POST",
    headers: {
      Authorization: `App ${creds.accountSecret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          destinations: [{ to }],
          from: creds.senderId,
          text: body,
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    messages?: Array<{ messageId?: string; status?: { groupName?: string; description?: string } }>;
  } | null;
  const first = payload?.messages?.[0];

  const groupName = first?.status?.groupName;
  const accepted = groupName === "PENDING" || groupName === "DELIVERED";
  if (!response.ok || !accepted) {
    return {
      success: false,
      error: first?.status?.description ?? `Infobip responded ${response.status}`,
    };
  }
  return { success: true, providerMessageId: first?.messageId };
}
