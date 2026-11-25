import type {
  AppTranslationKey,
  EmailIntegrationConfig,
  SmsIntegrationConfig,
} from "@mms/contracts";

/** Console-specific resolution of a failed save/test action. */
export interface ResolvedActionError {
  /** Inline panel error (rendered above the action buttons). */
  inlineMessage?: string;
  /** Toast description text. */
  description?: string;
}

export type ResolveActionError = (
  error: unknown,
  failedKey: AppTranslationKey,
) => ResolvedActionError;

export interface EmailIntegrationApi {
  /** Optional abort signal — the panel aborts in-flight loads on unmount/reload. */
  fetchConfig: (signal?: AbortSignal) => Promise<EmailIntegrationConfig | null | undefined>;
  saveConfig: (
    config: EmailIntegrationConfig & { smtpPassword?: string },
  ) => Promise<EmailIntegrationConfig>;
  testConfig: (testEmail?: string) => Promise<EmailIntegrationConfig>;
}

export interface SmsIntegrationApi {
  /** Optional abort signal — the panel aborts in-flight loads on unmount/reload. */
  fetchConfig: (signal?: AbortSignal) => Promise<SmsIntegrationConfig | null | undefined>;
  saveConfig: (
    config: SmsIntegrationConfig & { accountSecret?: string },
  ) => Promise<SmsIntegrationConfig>;
  testConfig: (testPhone: string) => Promise<SmsIntegrationConfig>;
}
