import { fetchSafeExternal } from "../../../lib/outboundUrl.js";
import type { SmsProviderCredentials, SmsSendResult } from "./types.js";

/** https://developer.telesign.com/enterprise/reference/sendmessage — Customer ID + API Key Basic Auth. */
export async function sendTelesignSms(
  to: string,
  body: string,
  creds: SmsProviderCredentials,
): Promise<SmsSendResult> {
  const authHeader = `Basic ${Buffer.from(`${creds.accountId}:${creds.accountSecret}`).toString("base64")}`;
  const params = new URLSearchParams({
    phone_number: to.replace(/^\+/, ""),
    message: body,
    message_type: "ARN", // Alerts/Reminders/Notifications — closest fit for verification codes and system alerts
  });

  const response = await fetchSafeExternal("https://rest.telesign.com/v1/messaging", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = (await response.json().catch(() => null)) as {
    reference_id?: string;
    status?: { code?: number; description?: string };
  } | null;

  if (!response.ok) {
    return {
      success: false,
      error: payload?.status?.description ?? `Telesign responded ${response.status}`,
    };
  }
  return { success: true, providerMessageId: payload?.reference_id };
}
