import { useMutation, useQuery } from "@tanstack/react-query";
import { SETUP_STALE_TIME } from "@/lib/queryClient";
import { useAuthOrNull, useQueryClientOrFallback } from "@/lib/query/optionalQueryContext";

function resolveValue<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

export interface CreateModuleSetupConfigHooksOptions<
  TPreferences extends object,
  TPreferencesInput = TPreferences,
> {
  preferencesQueryKey: readonly unknown[];
  fetchPreferences: (signal?: AbortSignal) => Promise<TPreferences>;
  savePreferences: (prefs: TPreferencesInput) => Promise<TPreferences>;
  setPreferencesMemory?: (prefs: TPreferences) => void;
  preferencesPlaceholder: TPreferences | (() => TPreferences);
}

/** Shared preferences Query/mutation hooks for module Setup. */
export function createModuleSetupConfigHooks<
  TPreferences extends object,
  TPreferencesInput = TPreferences,
>({
  preferencesQueryKey,
  fetchPreferences,
  savePreferences,
  setPreferencesMemory,
  preferencesPlaceholder,
}: CreateModuleSetupConfigHooksOptions<TPreferences, TPreferencesInput>) {
  // Pre-resolve once at creation so placeholder identity is completely stable
  // across every component render pass and does not trigger render-phase loops.
  const staticPlaceholder = resolveValue(preferencesPlaceholder);

  function usePreferencesQuery() {
    const auth = useAuthOrNull();
    const queryClient = useQueryClientOrFallback();
    return useQuery<TPreferences, Error, TPreferences>(
      {
        queryKey: preferencesQueryKey,
        queryFn: ({ signal }) => fetchPreferences(signal),
        enabled: Boolean(auth?.isAuthenticated),
        // TanStack Query NonFunctionGuard cannot be proven for generic TPreferences.
        // @ts-expect-error generic placeholderData vs NonFunctionGuard<TPreferences>
        placeholderData: (previousData) => previousData ?? staticPlaceholder,
        staleTime: SETUP_STALE_TIME,
        gcTime: 10 * 60_000,
      },
      queryClient,
    );
  }

  function usePreferencesMutation() {
    const queryClient = useQueryClientOrFallback();
    return useMutation(
      {
        mutationFn: (preferences: TPreferencesInput) => savePreferences(preferences),
        onSuccess: (saved) => {
          setPreferencesMemory?.(saved);
          queryClient.setQueryData(preferencesQueryKey, saved);
          void queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
        },
      },
      queryClient,
    );
  }

  return {
    usePreferencesQuery,
    usePreferencesMutation,
  };
}
