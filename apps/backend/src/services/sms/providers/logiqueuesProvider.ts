import { fetchSafeExternal, safeExternalHttpUrl } from "../../../lib/outboundUrl.js";
import type { SmsProviderCredentials, SmsSendResult } from "./types.js";

const DEFAULT_BASE_URL = "https://logiqueues.com/gateway/v1";

/**
 * Logiqueues SMS Gateway — sends through the client's own paired Android phone(s) via
 * sms-gateway-server. API key format `sgw_live_…`, response `202 { id, status: "queued" }`.
 * Errors are `{ error: <code>, message }`; see that project's README for the full code table.
 */
export async function sendLogiqueuesSms(
  to: string,
  body: string,
  creds: SmsProviderCredentials,
): Promise<SmsSendResult> {
  let baseUrl: string;
  try {
    baseUrl = safeExternalHttpUrl(
      creds.apiBaseUrl?.trim() || DEFAULT_BASE_URL,
      "Logiqueues API base URL",
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid Logiqueues API base URL",
    };
  }

  const response = await fetchSafeExternal(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accountSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, body }),
  });

  const payload = (await response.json().catch(() => null)) as
    { id?: string; status?: string } | { error?: string; message?: string } | null;

  if (!response.ok) {
    const errorPayload = payload as { error?: string; message?: string } | null;
    return {
      success: false,
      error:
        errorPayload?.message ?? errorPayload?.error ?? `Logiqueues responded ${response.status}`,
    };
  }

  const successPayload = payload as { id?: string } | null;
  return { success: true, providerMessageId: successPayload?.id };
}
