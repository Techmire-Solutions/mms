/**
 * Users Setup field-config + preferences via typed REST.
 */
import {
  composeUsersSettings,
  normalizeUserModulePreferences,
  normalizeUsersSettings,
  stripUserFieldConfigForPersist,
  type UserModulePreferences,
  type UsersSettings,
} from "@mms/shared";
import { apiContract } from "@/lib/api";

let memoryFieldConfig: UsersSettings | null = null;
let memoryPreferences: UserModulePreferences | null = null;

export function setUserFieldConfigMemory(config: UsersSettings): void {
  memoryFieldConfig = normalizeUsersSettings(config);
}

export function setUserPreferencesMemory(preferences: UserModulePreferences): void {
  memoryPreferences = normalizeUserModulePreferences(preferences);
}

export async function fetchUserFieldConfig(_signal?: AbortSignal): Promise<UsersSettings> {
  const response = await apiContract.users.getFieldConfig({
    query: {},
    params: {},
    extraHeaders: {},
  });
  const data = response.body as { config: UsersSettings | null };
  const merged = normalizeUsersSettings(data?.config ?? null);
  memoryFieldConfig = merged;
  return merged;
}

export async function saveUserFieldConfigAsync(config: UsersSettings): Promise<UsersSettings> {
  const bodyPayload = stripUserFieldConfigForPersist(config);
  const response = await apiContract.users.updateFieldConfig({ body: bodyPayload });
  const data = response.body as { success: boolean; config: UsersSettings };
  const saved = normalizeUsersSettings({
    ...(data?.config ?? bodyPayload),
    formTabs: data?.config?.formTabs ?? config.formTabs,
  });
  memoryFieldConfig = saved;
  return saved;
}

export async function fetchUserPreferences(_signal?: AbortSignal): Promise<UserModulePreferences> {
  const response = await apiContract.users.getPreferences({
    query: {},
    params: {},
    extraHeaders: {},
  });
  const data = response.body as { preferences: UserModulePreferences };
  const normalized = normalizeUserModulePreferences(data?.preferences ?? null);
  memoryPreferences = normalized;
  return normalized;
}

export async function saveUserPreferencesAsync(
  preferences: UserModulePreferences | UsersSettings,
): Promise<UserModulePreferences> {
  const normalized = normalizeUserModulePreferences(preferences);
  const response = await apiContract.users.updatePreferences({ body: normalized });
  const data = response.body as { success: boolean; preferences: UserModulePreferences };
  const saved = normalizeUserModulePreferences(data?.preferences ?? normalized);
  memoryPreferences = saved;
  return saved;
}

export function getUserSettingsMemoryFallback(): UsersSettings {
  return composeUsersSettings(
    memoryFieldConfig,
    memoryPreferences ?? normalizeUserModulePreferences(null),
    memoryFieldConfig?.formTabs,
  );
}
