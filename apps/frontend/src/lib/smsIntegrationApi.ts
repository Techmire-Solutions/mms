import type { SmsIntegrationConfig } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export async function fetchSmsIntegration(): Promise<SmsIntegrationConfig | null> {
  try {
    return await apiJson<SmsIntegrationConfig>("/api/sms/integration");
  } catch {
    return null;
  }
}

export type SaveSmsIntegrationInput = SmsIntegrationConfig & {
  accountSecret?: string;
};

/**
 * Editable keys accepted by the `.strict()` write DTO. The GET response also
 * carries server-computed status (`connected`, `hasCredentials`, `lastTestAt`,
 * `lastTestOk`, `lastError`) which must be stripped before write.
 */
function toSmsIntegrationWriteBody(payload: SaveSmsIntegrationInput) {
  const body: Record<string, unknown> = {
    providerId: payload.providerId,
    senderId: payload.senderId,
  };
  if (payload.accountId !== undefined) body.accountId = payload.accountId;
  if (payload.apiBaseUrl !== undefined) body.apiBaseUrl = payload.apiBaseUrl;
  if (payload.accountSecret?.trim()) body.accountSecret = payload.accountSecret.trim();
  return body;
}

export async function saveSmsIntegration(
  payload: SaveSmsIntegrationInput,
): Promise<SmsIntegrationConfig> {
  return apiJson<SmsIntegrationConfig>("/api/sms/integration", {
    method: "PUT",
    body: JSON.stringify(toSmsIntegrationWriteBody(payload)),
  });
}

export async function testSmsIntegration(testPhone: string): Promise<SmsIntegrationConfig> {
  const response = await apiJson<{ config: SmsIntegrationConfig }>("/api/sms/integration/test", {
    method: "POST",
    body: JSON.stringify({ testPhone }),
  });
  return response.config;
}
