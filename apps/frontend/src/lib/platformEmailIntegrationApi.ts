import type { EmailIntegrationConfig } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export async function fetchPlatformEmailIntegration(): Promise<EmailIntegrationConfig | null> {
  try {
    return await apiJson<EmailIntegrationConfig>("/api/platform/email/integration");
  } catch {
    return null;
  }
}

export type SavePlatformEmailIntegrationInput = EmailIntegrationConfig & {
  smtpPassword?: string;
};

function toPlatformEmailIntegrationWriteBody(payload: SavePlatformEmailIntegrationInput) {
  const body: Record<string, unknown> = {
    providerId: payload.providerId,
    fromAddress: payload.fromAddress,
    fromName: payload.fromName,
    smtpUsername: payload.smtpUsername,
  };
  if (payload.smtpHost !== undefined) body.smtpHost = payload.smtpHost;
  if (payload.smtpPort !== undefined) body.smtpPort = payload.smtpPort;
  if (payload.smtpSecure !== undefined) body.smtpSecure = payload.smtpSecure;
  if (payload.smtpPassword?.trim()) body.smtpPassword = payload.smtpPassword.trim();
  return body;
}

export async function savePlatformEmailIntegration(
  payload: SavePlatformEmailIntegrationInput,
): Promise<EmailIntegrationConfig> {
  return apiJson<EmailIntegrationConfig>("/api/platform/email/integration", {
    method: "PUT",
    body: JSON.stringify(toPlatformEmailIntegrationWriteBody(payload)),
  });
}

export async function testPlatformEmailIntegration(): Promise<EmailIntegrationConfig> {
  const response = await apiJson<{ config: EmailIntegrationConfig }>(
    "/api/platform/email/integration/test",
    {
      method: "POST",
    },
  );
  return response.config;
}
