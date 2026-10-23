import { fetchSafeExternal } from "../../../lib/outboundUrl.js";
import type { WhatsappProviderCredentials, WhatsappSendResult } from "./types.js";

/** Infobip WhatsApp Business API. */
export async function sendInfobipWhatsApp(
  to: string,
  body: string,
  creds: WhatsappProviderCredentials,
): Promise<WhatsappSendResult> {
  const rawBase = creds.apiBaseUrl?.trim();
  if (!rawBase) {
    return { success: false, error: "Infobip WhatsApp requires an API Base URL." };
  }

  const base = rawBase.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const url = `https://${base}/whatsapp/1/message/text`;
  const cleanTo = to.replace(/[^0-9]/g, "");

  const payload = {
    from: creds.senderId.trim(),
    to: cleanTo,
    content: { text: body },
  };

  const response = await fetchSafeExternal(url, {
    method: "POST",
    headers: {
      Authorization: `App ${creds.accountSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const resJson = (await response.json().catch(() => null)) as {
    messages?: Array<{ messageId?: string; status?: { name?: string; description?: string } }>;
  } | null;

  if (!response.ok) {
    const errorDesc = resJson?.messages?.[0]?.status?.description;
    return {
      success: false,
      error: errorDesc ?? `Infobip WhatsApp responded ${response.status}`,
    };
  }

  return { success: true, providerMessageId: resJson?.messages?.[0]?.messageId };
}
