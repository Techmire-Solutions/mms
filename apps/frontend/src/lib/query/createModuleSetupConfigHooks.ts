import { useContext } from "react";
import { QueryClient, QueryClientContext, useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SETUP_STALE_TIME } from "@/lib/queryClient";

const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function useSafeQueryClient(): QueryClient {
  const client = useContext(QueryClientContext);
  return client ?? fallbackQueryClient;
}

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return null;
  }
}

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
  function usePreferencesQuery() {
    const auth = useSafeAuth();
    const queryClient = useSafeQueryClient();
    return useQuery(
      {
        queryKey: preferencesQueryKey,
        queryFn: ({ signal }) => fetchPreferences(signal),
        enabled: Boolean(auth?.isAuthenticated),
        // TanStack Query NonFunctionGuard cannot be proven for generic TPreferences.
        // @ts-expect-error generic placeholderData vs NonFunctionGuard<TPreferences>
        placeholderData: resolveValue(preferencesPlaceholder),
        staleTime: SETUP_STALE_TIME,
        gcTime: 10 * 60_000,
      },
      queryClient,
    );
  }

  function usePreferencesMutation() {
    const queryClient = useSafeQueryClient();
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
