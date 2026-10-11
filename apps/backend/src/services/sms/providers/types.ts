/** Resolved, provider-agnostic credential shape passed to every provider client. */
export interface SmsProviderCredentials {
  accountId: string;
  accountSecret: string;
  senderId: string;
  /** Only meaningful for providers with a per-account API host (Infobip). */
  apiBaseUrl?: string;
}

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export type SmsProviderSender = (
  to: string,
  body: string,
  creds: SmsProviderCredentials,
) => Promise<SmsSendResult>;
