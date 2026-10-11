import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
import { AUTH_PATHS } from "@/lib/apiClientHelpers";
import { useUiStateStore } from "@/lib/useUiStateStore";
import type { UserUiState } from "@mms/shared";

export function useInitializeUiState() {
  const initialize = useUiStateStore((s) => s.initialize);
  const isInitialized = useUiStateStore((s) => s.isInitialized);

  const { data, isSuccess } = useQuery({
    queryKey: ["me", "ui-state"],
    queryFn: async () => {
      const response = await apiJson<{ state: UserUiState }>(AUTH_PATHS.uiState);
      return response.state;
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
