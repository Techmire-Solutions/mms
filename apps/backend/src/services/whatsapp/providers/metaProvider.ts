import { fetchSafeExternal } from "../../../lib/outboundUrl.js";
import type { WhatsappProviderCredentials, WhatsappSendResult } from "./types.js";

/** Meta WhatsApp Cloud API — Graph API text message dispatch. */
export async function sendMetaWhatsApp(
  to: string,
  body: string,
  creds: WhatsappProviderCredentials,
): Promise<WhatsappSendResult> {
  const phoneNumberId = creds.phoneNumberId?.trim();
  if (!phoneNumberId) {
    return { success: false, error: "Meta WhatsApp Cloud API requires a Phone Number ID." };
  }

  const cleanTo = to.replace(/[^0-9]/g, "");
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: "text",
    text: { preview_url: false, body },
  };

  const response = await fetchSafeExternal(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accountSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const resJson = (await response.json().catch(() => null)) as {
    messages?: Array<{ id: string }>;
    error?: { message: string };
  } | null;

  if (!response.ok) {
    return {
      success: false,
      error: resJson?.error?.message ?? `Meta Cloud API responded ${response.status}`,
    };
  }

  return { success: true, providerMessageId: resJson?.messages?.[0]?.id };
}
