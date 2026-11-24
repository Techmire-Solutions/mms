import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import type { PlatformSetupStatus } from "@mms/contracts";
import { useTenant } from "@/lib/contexts/TenantContext";
import { PLATFORM_SETUP_STATUS_QUERY_KEY } from "@/platform/features/shell/lib/platformQueryKeys";

export { PLATFORM_SETUP_STATUS_QUERY_KEY } from "@/platform/features/shell/lib/platformQueryKeys";

export async function fetchPlatformSetupStatus(signal?: AbortSignal): Promise<PlatformSetupStatus> {
  const response = await apiContract.platform.getSetupStatus({
    fetchOptions: { signal },
  });
  if (response.status !== 200) {
    const body = response.body as { message?: string; type?: string };
    throw new ApiError(
      response.status,
      body?.message ?? `Platform setup status request failed (${response.status})`,
      body?.type,
    );
  }
  return response.body as PlatformSetupStatus;
}

/** First-run platform super-user setup status (apex only). */
export function usePlatformSetupStatus(): {
  setupStatus: PlatformSetupStatus | undefined;
  isLoadingSetup: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const { isApex } = useTenant();

  const query = useQuery({
    queryKey: PLATFORM_SETUP_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPlatformSetupStatus(signal),
    enabled: isApex,
    staleTime: 60_000,
    retry: 5,
    retryDelay: (attempt: number) => Math.min(attempt * 1000, 5000),
  });

  return {
    setupStatus: query.data,
    isLoadingSetup: isApex && query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useInvalidatePlatformSetupStatus(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: PLATFORM_SETUP_STATUS_QUERY_KEY });
  };
}
