import { fetchSafeExternal } from "../../../lib/outboundUrl.js";
import type { SmsProviderCredentials, SmsSendResult } from "./types.js";

/** https://docs.msg91.com/reference/send-sms — route 4 = transactional. `accountId` is unused. */
export async function sendMsg91Sms(
  to: string,
  body: string,
  creds: SmsProviderCredentials,
): Promise<SmsSendResult> {
  const response = await fetchSafeExternal("https://api.msg91.com/api/v2/sendsms", {
    method: "POST",
    headers: {
      authkey: creds.accountSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: creds.senderId,
      route: "4",
      country: "0",
      sms: [{ message: body, to: [to] }],
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    type?: string;
    message?: string;
  } | null;
  if (!response.ok || payload?.type !== "success") {
    return { success: false, error: payload?.message ?? `MSG91 responded ${response.status}` };
  }
  return { success: true, providerMessageId: payload.message };
}
