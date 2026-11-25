import { fetchSafeExternal, safeExternalHttpUrl } from "../lib/outboundUrl.js";

export interface GenericOutboundCredentials {
  apiBaseUrl?: string;
  accountSecret?: string;
  senderId?: string;
  accountId?: string;
}

export interface GenericOutboundResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

const DEFAULT_GATEWAY_URL = "https://logiqueues.com/gateway/v1/messages/smart";

/**
 * Universal Generic HTTP Gateway Provider.
 * Sends a standard JSON POST request { to, body } (with optional from: senderId)
 * and Authorization: Bearer <secret> directly to the configured endpoint URL.
 * Works seamlessly with LogiQueues URL-differentiated routing, webhooks, and REST endpoints.
 */
export async function sendGenericOutboundMessage(
  to: string,
  body: string,
  creds: GenericOutboundCredentials,
): Promise<GenericOutboundResult> {
  const rawUrl = creds.apiBaseUrl?.trim() || DEFAULT_GATEWAY_URL;

  let url: string;
  try {
    url = safeExternalHttpUrl(rawUrl, "Gateway URL");
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid Gateway URL",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (creds.accountSecret?.trim()) {
    headers.Authorization = `Bearer ${creds.accountSecret.trim()}`;
  }

  const payload: Record<string, unknown> = { to, body };
  if (creds.senderId?.trim()) {
    payload.from = creds.senderId.trim();
  }

  const response = await fetchSafeExternal(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const resJson = (await response.json().catch(() => null)) as
    | { id?: string; messageId?: string; sid?: string; status?: string }
    | { error?: string; message?: string }
    | null;

  if (!response.ok) {
    const errorPayload = resJson as { error?: string; message?: string } | null;
    return {
      success: false,
      error: errorPayload?.message ?? errorPayload?.error ?? `Gateway responded ${response.status}`,
    };
  }

  const successPayload = resJson as { id?: string; messageId?: string; sid?: string } | null;
  return {
    success: true,
    providerMessageId: successPayload?.id ?? successPayload?.messageId ?? successPayload?.sid,
  };
}
