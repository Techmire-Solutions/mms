import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { STATIC_LOOKUP_STALE_TIME } from "@/lib/queryClient";

export interface CreateModuleLookupsHooksOptions<
  TMap extends object,
  TKind extends string,
  TItems = string[],
> {
  queryKey: readonly unknown[];
  fetchLookups: (signal?: AbortSignal) => Promise<TMap>;
  putLookupKind: (kind: TKind, items: TItems) => Promise<TItems>;
  defaults: () => TMap;
}

/** Shared authenticated lookups query + kind PUT mutation for module Setup. */
export function createModuleLookupsHooks<
  TMap extends object,
  TKind extends string,
  TItems = string[],
>({
  queryKey,
  fetchLookups,
  putLookupKind,
  defaults,
}: CreateModuleLookupsHooksOptions<TMap, TKind, TItems>) {
  function useLookupsQuery() {
    const { isAuthenticated } = useAuth();
    return useQuery({
      queryKey,
      queryFn: ({ signal }) => fetchLookups(signal),
      enabled: isAuthenticated,
      // TanStack Query NonFunctionGuard cannot be proven for generic TMap (plain object at runtime).
      // @ts-expect-error generic placeholderData vs NonFunctionGuard<TMap>
      placeholderData: defaults(),
      staleTime: STATIC_LOOKUP_STALE_TIME,
      gcTime: 60 * 60_000,
    });
  }

  function useLookupMutation() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ kind, items }: { kind: TKind; items: TItems }) => putLookupKind(kind, items),
      onSuccess: (items, variables) => {
        queryClient.setQueryData<TMap>(queryKey, (current) => {
          const base = current ?? defaults();
          return { ...base, [variables.kind]: items } as TMap;
        });
        void queryClient.invalidateQueries({ queryKey });
      },
    });
  }

  return { useLookupsQuery, useLookupMutation };
}
