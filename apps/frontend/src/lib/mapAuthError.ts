import type { AppTranslationKey } from "@mms/shared";

/** The minimal error shape the auth mappers cascade over. */
export interface AuthErrorDescriptor {
  type?: unknown;
  status?: number;
  message?: string;
}

export type AuthErrorTranslateFn = (
  key: AppTranslationKey,
  params?: Record<string, string>,
) => string;

export interface MapAuthErrorConfig {
  /** Runtime guard for the console's recognized error-type union. */
  isErrorType: (value: unknown) => boolean;
  /** Recognized type → localized copy. */
  keyMap: Partial<Record<string, AppTranslationKey>>;
  /** HTTP status → localized copy fallback. */
  statusMap: Partial<Record<number, AppTranslationKey>>;
  /** Final fallback key when neither type nor status is mapped. */
  fallbackKey: AppTranslationKey;
  /** Types whose non-empty server message wins over the mapped key. */
  messageFirstTypes?: readonly string[];
  /** Use a non-empty server message when the type is recognized but unmapped. */
  messageFirstOnUnknown?: boolean;
  /** Statuses whose non-empty server message wins over the mapped key. */
  messageFirstStatuses?: readonly number[];
}

/**
 * Generic auth/API error cascade (SSOT): recognized type → mapped key (with
 * optional message-first types) → HTTP status key → fallback key. Used by the
 * tenant auth-error mapper and the platform auth-error mapper.
 */
export function mapAuthError(
  apiError: AuthErrorDescriptor | null | undefined,
  config: MapAuthErrorConfig,
  t: AuthErrorTranslateFn,
  params?: Record<string, string>,
): string {
  const message = apiError?.message?.trim();

  if (apiError && config.isErrorType(apiError.type)) {
    const type = apiError.type as string;
    if (config.messageFirstTypes?.includes(type) && message) return message;
    const key = config.keyMap[type];
    if (key) return t(key, params);
    if (config.messageFirstOnUnknown && message) return message;
    return t(config.fallbackKey, params);
  }

  if (apiError?.status !== undefined) {
    if (config.messageFirstStatuses?.includes(apiError.status) && message) return message;
    const statusKey = config.statusMap[apiError.status];
    if (statusKey) return t(statusKey, params);
  }

  return t(config.fallbackKey, params);
}
