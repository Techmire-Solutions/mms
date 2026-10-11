import { normalizeUserModulePreferences, type UserModulePreferences } from "@mms/shared";
import {
  getUserModulePreferencesByWorkspace,
  upsertUserModulePreferences,
} from "../db/repositories/userModulePreferencesRepository.js";
import { requireTenant } from "../lib/tenantContext.js";
import { broadcastCollection } from "../lib/livePush.js";
import { mergeWorkspaceRolesForPrefsSave } from "../faculty/use-cases/facultyManagedRolesPrefs.js";

export async function loadUserModulePreferences(): Promise<UserModulePreferences | null> {
  const raw = await getUserModulePreferencesByWorkspace(requireTenant());
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return normalizeUserModulePreferences(raw);
}

/**
 * Saves users module preferences. Faculty-managed composite roles omitted by the
 * Roles editor are preserved and refreshed from updated catalog definitions.
 */
export async function saveUserModulePreferences(
  preferences: UserModulePreferences | Record<string, unknown>,
): Promise<UserModulePreferences> {
  const tenant = requireTenant();
  const existingRaw = await getUserModulePreferencesByWorkspace(tenant);
  const existing = normalizeUserModulePreferences(existingRaw);
  const incoming = normalizeUserModulePreferences(preferences);
  const workspaceRoles = mergeWorkspaceRolesForPrefsSave(
    incoming.workspaceRoles,
    existing.workspaceRoles,
  );
  const normalized: UserModulePreferences = { ...incoming, workspaceRoles };
  await upsertUserModulePreferences(tenant, Object.assign({}, normalized));
  await broadcastCollection("users");
  return normalized;
}
