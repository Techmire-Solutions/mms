import { useCallback } from "react";
import { normalizeModuleTierTabId } from "@mms/shared";
import { useUiPreference } from "@/lib/useUiStateStore";

/**
 * Stable identity normalizer for non-tier tab sets whose ids are already
 * canonical (e.g. `/settings` sections). Module-level so passing it keeps the
 * `usePersistedTabState` setter memoized.
 */
export const identityTabNormalizer = (value: string): string => value;

/**
 * Tab state synced to backend UI state so navigation does not reset the active
 * tab across devices. `normalize` maps persisted ids to canonical ones — module
 * tiers migrate legacy ids (`operations`→`work`, `analytics`→`reports`,
 * `configuration`→`setup`). Non-tier tab sets (e.g. `/settings` sections) should
 * pass an identity function since their ids are already canonical.
 *
 * The returned setter is referentially stable (memoized on the store setter),
 * so consumers can list it in `useCallback`/effect deps without re-registering
 * listeners on every render.
 */
export function usePersistedTabState<T extends string>(
  key: string,
  defaultValue: T,
  normalize: (value: string) => string = normalizeModuleTierTabId,
): [T, (value: T) => void] {
  const [value, setUiPref] = useUiPreference<T>(key, defaultValue);

  const setPersisted = useCallback(
    (tabValue: T) => {
      setUiPref(normalize(tabValue) as T);
    },
    [setUiPref, normalize],
  );

  const normalizedValue = (() => (normalize(value as string) as T) || defaultValue)();

  return [normalizedValue, setPersisted];
}
