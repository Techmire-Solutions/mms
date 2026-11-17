import { normalizeModuleTierTabId } from "@mms/shared";
import { useUiPreference } from "@/lib/useUiStateStore";

/**
 * Tab state synced to backend UI state so navigation does not reset the active
 * tab across devices. `normalize` maps persisted ids to canonical ones — module
 * tiers migrate legacy ids (`operations`→`work`, `analytics`→`reports`,
 * `configuration`→`setup`). Non-tier tab sets (e.g. `/settings` sections) should
 * pass an identity function since their ids are already canonical.
 */
export function usePersistedTabState<T extends string>(
  key: string,
  defaultValue: T,
  normalize: (value: string) => string = normalizeModuleTierTabId,
): [T, (value: T) => void] {
  const [value, setUiPref] = useUiPreference<T>(key, defaultValue);

  const setPersisted = (tabValue: T) => {
    setUiPref(normalize(tabValue) as T);
  };

  const normalizedValue = (() => (normalize(value as string) as T) || defaultValue)();

  return [normalizedValue, setPersisted];
}
