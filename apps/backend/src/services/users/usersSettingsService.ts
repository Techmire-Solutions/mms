import {
  DEFAULT_USERS_SETTINGS,
  normalizeUserModulePreferences,
  type UsersSettings,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { getUserModulePreferencesByWorkspace } from "../../db/repositories/userModulePreferencesRepository.js";

/**
 * Loads tenant users module settings used by auth (registration / verification policy).
 * Reads typed `user_module_preferences` (not document-store `users_settings`).
 */
export async function getTenantUsersSettings(): Promise<UsersSettings> {
  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) {
    return { ...DEFAULT_USERS_SETTINGS };
  }
  const raw = await getUserModulePreferencesByWorkspace(tenant);
  const prefs = normalizeUserModulePreferences(raw);
  return {
    ...DEFAULT_USERS_SETTINGS,
    ...prefs,
  };
}
