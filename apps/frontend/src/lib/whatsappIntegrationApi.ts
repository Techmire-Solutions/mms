import type { WhatsappIntegrationConfig } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export async function fetchWhatsappIntegration(): Promise<WhatsappIntegrationConfig | null> {
  try {
    return await apiJson<WhatsappIntegrationConfig>("/api/whatsapp/integration");
  } catch {
    return null;
  }
}

export type SaveWhatsappIntegrationInput = WhatsappIntegrationConfig & {
  accountSecret?: string;
};

/**
 * Editable keys accepted by the `.strict()` write DTO.
 */
function toWhatsappIntegrationWriteBody(payload: SaveWhatsappIntegrationInput) {
  const body: Record<string, unknown> = {
    providerId: payload.providerId,
    senderId: payload.senderId,
  };
  if (payload.accountId !== undefined) body.accountId = payload.accountId;
  if (payload.phoneNumberId !== undefined) body.phoneNumberId = payload.phoneNumberId;
  if (payload.apiBaseUrl !== undefined) body.apiBaseUrl = payload.apiBaseUrl;
  if (payload.accountSecret?.trim()) body.accountSecret = payload.accountSecret.trim();
  return body;
}

export async function saveWhatsappIntegration(
  payload: SaveWhatsappIntegrationInput,
): Promise<WhatsappIntegrationConfig> {
  return apiJson<WhatsappIntegrationConfig>("/api/whatsapp/integration", {
    method: "PUT",
    body: JSON.stringify(toWhatsappIntegrationWriteBody(payload)),
  });
}

export async function testWhatsappIntegration(
  testPhone: string,
): Promise<WhatsappIntegrationConfig> {
  const response = await apiJson<{ config: WhatsappIntegrationConfig }>(
    "/api/whatsapp/integration/test",
    {
      method: "POST",
      body: JSON.stringify({ testPhone }),
    },
  );
  return response.config;
}
