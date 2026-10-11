import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  isModuleAccessDenialCode,
  moduleAccessContract,
  moduleAccessResponseSchema,
  type ModuleAvailabilityMap,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { isApiError } from "@/lib/apiError";

/**
 * The `auth` segment keeps this query out of IndexedDB persistence
 * (`canPersistQuery`), so access is only ever taken from a network response in
 * the current session — never from browser storage.
 */
export const MODULE_ACCESS_QUERY_KEY = ["auth", "module-access"] as const;

export async function fetchModuleAccess(signal?: AbortSignal): Promise<ModuleAvailabilityMap> {
  const body = await apiJson<unknown>(moduleAccessContract.get.path, { signal });
  return moduleAccessResponseSchema.parse(body).modules;
}

export function moduleAccessQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: MODULE_ACCESS_QUERY_KEY,
    queryFn: ({ signal }) => fetchModuleAccess(signal),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });
}

/** A module-gate 403 means our snapshot is stale; refetch it so every gate re-evaluates. */
export function refreshModuleAccessOnDenial(queryClient: QueryClient, error: unknown): void {
  if (isApiError(error) && error.status === 403 && isModuleAccessDenialCode(error.code)) {
    void queryClient.invalidateQueries({ queryKey: MODULE_ACCESS_QUERY_KEY });
  }
}
