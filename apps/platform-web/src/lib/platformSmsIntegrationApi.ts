import type { SmsIntegrationConfig } from "@mms/contracts";
import { apiJson } from "@mms/fe-core/api/client";

export async function fetchPlatformSmsIntegration(
  signal?: AbortSignal,
): Promise<SmsIntegrationConfig | null> {
  try {
    return await apiJson<SmsIntegrationConfig>(
      "/api/platform/sms/integration",
      signal ? { signal } : undefined,
    );
  } catch {
    return null;
  }
}

export type SavePlatformSmsIntegrationInput = SmsIntegrationConfig & {
  accountSecret?: string;
};

function toPlatformSmsIntegrationWriteBody(payload: SavePlatformSmsIntegrationInput) {
  const body: Record<string, unknown> = {
    providerId: payload.providerId,
    senderId: payload.senderId,
  };
  if (payload.accountId !== undefined) body.accountId = payload.accountId;
  if (payload.apiBaseUrl !== undefined) body.apiBaseUrl = payload.apiBaseUrl;
  if (payload.accountSecret?.trim()) body.accountSecret = payload.accountSecret.trim();
  return body;
}

export async function savePlatformSmsIntegration(
  payload: SavePlatformSmsIntegrationInput,
): Promise<SmsIntegrationConfig> {
  return apiJson<SmsIntegrationConfig>("/api/platform/sms/integration", {
    method: "PUT",
    body: JSON.stringify(toPlatformSmsIntegrationWriteBody(payload)),
  });
}

export async function testPlatformSmsIntegration(testPhone: string): Promise<SmsIntegrationConfig> {
  const response = await apiJson<{ config: SmsIntegrationConfig }>(
    "/api/platform/sms/integration/test",
    {
      method: "POST",
      body: JSON.stringify({ testPhone }),
    },
  );
  return response.config;
}
