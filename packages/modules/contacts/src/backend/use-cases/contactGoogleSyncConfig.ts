import { requireTenant } from "@mms/be-core/http";
import { contactGoogleSyncRepository } from "../repository/contactGoogleSyncAdapter.js";
import type { ContactGoogleSyncCredentialRecord } from "../repository/contactGoogleSyncRepository.js";

export type ContactGoogleSyncConfig = ContactGoogleSyncCredentialRecord;

export interface ContactGoogleSyncConfigClient {
  clientId?: string;
  updatedAt?: string;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  isConnected: boolean;
}

export class GoogleOAuthExchangeError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "GoogleOAuthExchangeError";
    this.code = code;
  }
}

export class GoogleSyncError extends Error {
  readonly code: "not_connected" | "session_expired" | "api_error";

  constructor(message: string, code: "not_connected" | "session_expired" | "api_error") {
    super(message);
    this.name = "GoogleSyncError";
    this.code = code;
  }
}

export async function getContactGoogleSyncConfig(userId: string): Promise<ContactGoogleSyncConfig> {
  return contactGoogleSyncRepository.findCredentials(requireTenant(), userId);
}

export async function setContactGoogleSyncConfig(
  userId: string,
  config: ContactGoogleSyncConfig,
): Promise<ContactGoogleSyncConfig> {
  return contactGoogleSyncRepository.upsertCredentials(requireTenant(), userId, {
    ...config,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearContactGoogleSyncConfig(userId: string): Promise<void> {
  await contactGoogleSyncRepository.deleteCredentials(requireTenant(), userId);
}

export async function clearGoogleSyncTokens(
  userId: string,
): Promise<ContactGoogleSyncConfigClient> {
  const existing = await getContactGoogleSyncConfig(userId);
  const saved = await setContactGoogleSyncConfig(userId, {
    ...existing,
    accessToken: undefined,
    refreshToken: undefined,
  });
  return redactGoogleSyncConfigForClient(saved);
}

export function redactGoogleSyncConfigForClient(
  config: ContactGoogleSyncConfig,
): ContactGoogleSyncConfigClient {
  return {
    clientId: config.clientId,
    updatedAt: config.updatedAt,
    hasClientSecret: Boolean(config.clientSecret),
    hasRefreshToken: Boolean(config.refreshToken),
    isConnected: Boolean(config.accessToken),
  };
}
