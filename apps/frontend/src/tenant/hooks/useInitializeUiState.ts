import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useUiStateStore } from "@/lib/useUiStateStore";
import type { UserUiState } from "@mms/shared";

export function useInitializeUiState() {
  const initialize = useUiStateStore((s) => s.initialize);
  const isInitialized = useUiStateStore((s) => s.isInitialized);

  const { data, isSuccess } = useQuery({
    queryKey: ["me", "ui-state"],
    queryFn: async () => {
      const response = await apiContract.auth.getUiState({});
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load UI state",
          errorBody?.type,
        );
      }
      return (response.body as { state: UserUiState }).state;
    },
    staleTime: Infinity, // fetch once per session
    enabled: !isInitialized, // Only fetch if not already initialized
  });

  useEffect(() => {
    if (isSuccess && data && !isInitialized) {
      initialize(data);
    }
  }, [isSuccess, data, initialize, isInitialized]);
}
