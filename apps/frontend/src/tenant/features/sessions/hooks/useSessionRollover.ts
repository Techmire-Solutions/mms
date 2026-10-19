import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PromotionPreviewRow, SessionRolloverInput } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  SESSION_ROLLOVER_RUNS_QUERY_KEY,
  previewRolloverMutationOptions,
  sessionRolloverRunsQueryOptions,
  startRolloverMutationOptions,
} from "@/lib/query/sessionRolloverQueries";

export function useSessionRolloverRuns(sessionId: string) {
  const { isAuthenticated } = useAuth();
  return useQuery(sessionRolloverRunsQueryOptions(sessionId, isAuthenticated));
}

const detail = (error: unknown) =>
  isApiError(error) && error.status < 500 ? error.message : undefined;

/** Preview and start a rollover with call-site toasts. */
export function useSessionRolloverActions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const previewMutation = useMutation(previewRolloverMutationOptions());
  const startMutation = useMutation({
    ...startRolloverMutationOptions(),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: SESSION_ROLLOVER_RUNS_QUERY_KEY }),
  });

  const preview = async (
    id: string,
    body: SessionRolloverInput,
  ): Promise<PromotionPreviewRow[] | null> => {
    try {
      return await previewMutation.mutateAsync({ id, body });
    } catch (error) {
      notify.error(t("sessions.rollover.previewFailed"), { description: detail(error) });
      return null;
    }
  };

  const start = async (id: string, body: SessionRolloverInput): Promise<boolean> => {
    try {
      await startMutation.mutateAsync({ id, body });
      notify.success(t("sessions.rollover.started"));
      return true;
    } catch (error) {
      notify.error(t("sessions.rollover.startFailed"), { description: detail(error) });
      return false;
    }
  };

  return {
    preview,
    start,
    isPending: previewMutation.isPending || startMutation.isPending,
  };
}
