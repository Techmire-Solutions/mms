import type { AppTranslationKey } from "../i18n/appTranslations.js";
import { SMS_INTEGRATION_OBJECT_KEY, SMS_INTEGRATION_SECRETS_KEY } from "./smsIntegrationTypes.js";
import {
  WHATSAPP_INTEGRATION_OBJECT_KEY,
  WHATSAPP_INTEGRATION_SECRETS_KEY,
} from "./whatsappIntegrationTypes.js";

/** Logical object keys for email integration storage. */
export const EMAIL_INTEGRATION_OBJECT_KEY = "email_integration" as const;

/** Backend-only — never synced to the browser. */
export const EMAIL_INTEGRATION_SECRETS_KEY = "email_integration_secrets" as const;

/** Per-user export download handles — ephemeral, not restorable. */
export const USER_EXPORT_ARTIFACTS_OBJECT_KEY = "user_export_artifacts" as const;

/** Dedup-scan cache — ephemeral, not restorable. */
export const CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY = "contacts_duplicate_scan_cache" as const;

/** Google Contacts OAuth tokens/secrets — legacy objects key only.
 * Runtime storage is `contact_google_sync_credentials` (FORCE RLS).
 * Kept in SERVER_ONLY_OBJECT_KEYS so old backups still strip this object. */
export const CONTACT_GOOGLE_SYNC_BY_USER_OBJECT_KEY = "contact_google_sync_by_user" as const;

/**
 * Object keys withheld from backup export and browser object reads.
 * Inbound sync strips these instead of rejecting the whole restore.
 */
const SERVER_ONLY_OBJECT_KEYS: readonly string[] = [
  EMAIL_INTEGRATION_OBJECT_KEY,
  EMAIL_INTEGRATION_SECRETS_KEY,
  SMS_INTEGRATION_OBJECT_KEY,
  SMS_INTEGRATION_SECRETS_KEY,
  WHATSAPP_INTEGRATION_OBJECT_KEY,
  WHATSAPP_INTEGRATION_SECRETS_KEY,
  USER_EXPORT_ARTIFACTS_OBJECT_KEY,
  CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY,
  CONTACT_GOOGLE_SYNC_BY_USER_OBJECT_KEY,
] as const;

/**
 * Server-only keys that must be deleted on a full workspace restore
 * (ephemeral caches/artifacts). Credential stores stay on the server.
 */
export const BACKUP_EPHEMERAL_OBJECT_KEYS: readonly string[] = [
  USER_EXPORT_ARTIFACTS_OBJECT_KEY,
  CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY,
] as const;

export function isServerOnlyObjectKey(key: string): boolean {
  return SERVER_ONLY_OBJECT_KEYS.includes(key);
}

/**
 * Object keys that stay browser-accessible but are excluded from backup
 * export/restore and preserved across a full restore (never pruned, never written).
 *
 * Historical document-store key `platform_settings` once held per-tenant module
 * grants. Grants now live on `workspaces.granted_modules` (SQL). The apex SQL
 * table `platform_settings` is unrelated — it stores TLS/Certbot config only.
 *
 * The key remains excluded from tenant backup round-trips (caught by the
 * `platform_*` restricted-key guard) so a crafted snapshot cannot resurrect
 * revoked modules. Unlike `SERVER_ONLY_OBJECT_KEYS` it is NOT withheld from the
 * browser if a legacy objects row still exists.
 */
export const BACKUP_EXCLUDED_OBJECT_KEYS: readonly string[] = ["platform_settings"] as const;

export function isBackupExcludedObjectKey(key: string): boolean {
  return BACKUP_EXCLUDED_OBJECT_KEYS.includes(key);
}

const EMAIL_PROVIDERS = [
  "gmail",
  "microsoft365",
  "outlook",
  "yahoo",
  "icloud",
  "zoho",
  "custom_smtp",
] as const;

export type EmailProviderId = (typeof EMAIL_PROVIDERS)[number];

const EMAIL_PROVIDERS_SET = new Set<string>(EMAIL_PROVIDERS);

export function isEmailProviderId(value: unknown): value is EmailProviderId {
  return typeof value === "string" && EMAIL_PROVIDERS_SET.has(value);
}

export type EmailConnectionType = "smtp" | "oauth";

export interface EmailProviderPreset {
  id: EmailProviderId;
  labelKey: AppTranslationKey;
  hintKey: AppTranslationKey;
  connectionType: EmailConnectionType;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
  /** BCP 47 hint for default from-address domain examples in UI. */
  exampleDomain: string;
}

/** Public integration config (safe to store in tenant sync). */
export interface EmailIntegrationConfig {
  providerId: EmailProviderId;
  fromAddress: string;
  fromName: string;
  smtpUsername: string;
  /** Custom SMTP host when `providerId` is `custom_smtp`. */
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  connected: boolean;
  hasCredentials: boolean;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastError?: string;
}

/** Credentials — server-side only. */
export interface EmailIntegrationSecrets {
  smtpPassword?: string;
}

export const DEFAULT_EMAIL_INTEGRATION: EmailIntegrationConfig = {
  providerId: "gmail",
  fromAddress: "",
  fromName: "Madrasa Management System",
  smtpUsername: "",
  connected: false,
  hasCredentials: false,
};

export function mergeEmailIntegrationConfig(
  partial?: Partial<EmailIntegrationConfig> | null,
): EmailIntegrationConfig {
  const providerId = partial?.providerId ?? DEFAULT_EMAIL_INTEGRATION.providerId;
  return {
    ...DEFAULT_EMAIL_INTEGRATION,
    ...partial,
    providerId: isEmailProviderId(providerId) ? providerId : DEFAULT_EMAIL_INTEGRATION.providerId,
    fromName: partial?.fromName?.trim() || DEFAULT_EMAIL_INTEGRATION.fromName,
    fromAddress: partial?.fromAddress?.trim() ?? "",
    smtpUsername: partial?.smtpUsername?.trim() ?? "",
  };
}
