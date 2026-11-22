import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useUiStateStore } from "@/lib/useUiStateStore";
import type { UserUiState } from "@mms/shared";

/**
 * UI-state cache key carries the `auth` segment so `canPersistQuery` never
 * writes per-user preferences to IndexedDB — a re-login must refetch them.
 */
const UI_STATE_QUERY_KEY = ["auth", "me", "ui-state"] as const;

/**
 * Seeds the per-user UI-state store from the server once per session.
 * Gated on the resolved session so unauthenticated shell mounts never fire
 * the request, and aborted via the forwarded signal on unmount.
 */
export function useInitializeUiState() {
  const { isAuthenticated } = useAuth();
  const initialize = useUiStateStore((s) => s.initialize);
  const isInitialized = useUiStateStore((s) => s.isInitialized);

  const { data, isSuccess } = useQuery({
    queryKey: UI_STATE_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.auth.getUiState({ signal, fetchOptions: { signal } });
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
    enabled: isAuthenticated && !isInitialized, // Only fetch for an authenticated, unseeded session
  });

  useEffect(() => {
    if (isSuccess && data && !isInitialized) {
      initialize(data);
    }
  }, [isSuccess, data, initialize, isInitialized]);
}
