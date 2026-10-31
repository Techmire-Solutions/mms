import { useMutation, useQuery } from "@tanstack/react-query";
import { STATIC_LOOKUP_STALE_TIME } from "@/lib/queryClient";
import { useAuthOrNull, useQueryClientOrFallback } from "@/lib/query/optionalQueryContext";

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
  // Pre-resolve once at creation so placeholder reference identity is completely stable
  // across every component render pass and does not trigger render-phase loops.
  const staticDefaults = defaults();

  function useLookupsQuery() {
    const auth = useAuthOrNull();
    const queryClient = useQueryClientOrFallback();
    return useQuery<TMap, Error, TMap>(
      {
        queryKey,
        queryFn: ({ signal }) => fetchLookups(signal),
        enabled: Boolean(auth?.isAuthenticated),
        // TanStack Query NonFunctionGuard cannot be proven for generic TMap (plain object at runtime).
        // @ts-expect-error generic placeholderData vs NonFunctionGuard<TMap>
        placeholderData: (previousData) => previousData ?? staticDefaults,
        staleTime: STATIC_LOOKUP_STALE_TIME,
        gcTime: 60 * 60_000,
      },
      queryClient,
    );
  }

  function useLookupMutation() {
    const queryClient = useQueryClientOrFallback();
    return useMutation(
      {
        mutationFn: ({ kind, items }: { kind: TKind; items: TItems }) => putLookupKind(kind, items),
        onSuccess: (items, variables) => {
          queryClient.setQueryData<TMap>(queryKey, (current) => {
            const base = current ?? staticDefaults;
            return { ...base, [variables.kind]: items } as TMap;
          });
          void queryClient.invalidateQueries({ queryKey });
        },
      },
      queryClient,
    );
  }

  return { useLookupsQuery, useLookupMutation };
}
