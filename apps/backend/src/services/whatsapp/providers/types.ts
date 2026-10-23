export interface WhatsappProviderCredentials {
  accountId: string;
  phoneNumberId?: string;
  accountSecret: string;
  senderId: string;
  apiBaseUrl?: string;
}

export interface WhatsappSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export type WhatsappProviderSender = (
  to: string,
  body: string,
  creds: WhatsappProviderCredentials,
) => Promise<WhatsappSendResult>;
