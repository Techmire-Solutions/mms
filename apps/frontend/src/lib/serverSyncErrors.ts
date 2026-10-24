import type { AppTranslationKey } from "@mms/shared";

/** Translation key for a failed branding/global settings server sync. */
export function serverSyncErrorKey(status?: number): AppTranslationKey {
  if (status === 401) return "settings.serverSaveUnauthorized";
  if (status === 403) return "settings.serverSaveForbidden";
  return "settings.serverSaveOffline";
}
