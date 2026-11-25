import type { EmailIntegrationConfig } from "@mms/contracts";
import { apiJson } from "@mms/fe-core/api/client";

export async function fetchEmailIntegration(
  signal?: AbortSignal,
): Promise<EmailIntegrationConfig | null> {
  try {
    return await apiJson<EmailIntegrationConfig>(
      "/api/email/integration",
      signal ? { signal } : undefined,
    );
  } catch {
    return null;
  }
}

export type SaveEmailIntegrationInput = EmailIntegrationConfig & {
  smtpPassword?: string;
};

/**
 * Editable keys accepted by the `.strict()` write DTO. The GET response also
 * carries server-computed status (`connected`, `hasCredentials`, `lastTestAt`,
 * `lastTestOk`, `lastError`) which must be stripped before write.
 */
function toEmailIntegrationWriteBody(payload: SaveEmailIntegrationInput) {
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

export async function saveEmailIntegration(
  payload: SaveEmailIntegrationInput,
): Promise<EmailIntegrationConfig> {
  return apiJson<EmailIntegrationConfig>("/api/email/integration", {
    method: "PUT",
    body: JSON.stringify(toEmailIntegrationWriteBody(payload)),
  });
}

export async function testEmailIntegration(testEmail?: string): Promise<EmailIntegrationConfig> {
  const integrationResponse = await apiJson<{ config: EmailIntegrationConfig }>(
    "/api/email/integration/test",
    {
      method: "POST",
      body: JSON.stringify({ testEmail: testEmail?.trim() || undefined }),
    },
  );
  return integrationResponse.config;
}

export async function sendVerificationCodeEmail(code: string): Promise<boolean> {
  try {
    const verificationResponse = await apiJson<{ delivered?: boolean }>(
      "/api/email/verification-code",
      {
        method: "POST",
        body: JSON.stringify({ code }),
      },
    );
    return verificationResponse.delivered === true;
  } catch {
    return false;
  }
}
