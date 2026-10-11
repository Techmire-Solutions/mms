import { normalizeModuleTierTabId } from "@mms/shared";
import { useUiPreference } from "@/lib/useUiStateStore";

/**
 * Tab state synced to backend UI state so module navigation does not reset the active tier across devices.
 */
export function usePersistedTabState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setUiPref] = useUiPreference<T>(key, defaultValue);

  const setPersisted = (tabValue: T) => {
    setUiPref(normalizeModuleTierTabId(tabValue) as T);
  };

  const normalizedValue = (() =>
    (normalizeModuleTierTabId(value as string) as T) || defaultValue)();

  return [normalizedValue, setPersisted];
}
