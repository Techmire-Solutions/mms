import { fetchSafeExternal } from "../../../lib/outboundUrl.js";
import type { SmsProviderCredentials, SmsSendResult } from "./types.js";

/** https://developer.vonage.com/en/api/sms — classic SMS API, api_key/api_secret auth. */
export async function sendVonageSms(
  to: string,
  body: string,
  creds: SmsProviderCredentials,
): Promise<SmsSendResult> {
  const response = await fetchSafeExternal("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: creds.accountId,
      api_secret: creds.accountSecret,
      to,
      from: creds.senderId,
      text: body,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    messages?: Array<{ status?: string; "message-id"?: string; "error-text"?: string }>;
  } | null;
  const first = payload?.messages?.[0];

  if (!response.ok || !first || first.status !== "0") {
    return {
      success: false,
      error: first?.["error-text"] ?? `Vonage responded ${response.status}`,
    };
  }
  return { success: true, providerMessageId: first["message-id"] };
}
