import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { invalidateSessionDependents } from "./invalidateSessionDependents";

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
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const previewMutation = useMutation(previewRolloverMutationOptions());
  const startMutation = useMutation({
    ...startRolloverMutationOptions(),
    onSettled: (_data, _error, variables) => {
      invalidateSessionDependents(queryClient, {
        enrollments: true,
        calendar: variables.body.copy.calendar === true,
      });
      void queryClient.invalidateQueries({ queryKey: SESSION_ROLLOVER_RUNS_QUERY_KEY });
    },
  });

  const preview = async (
    id: string,
    body: SessionRolloverInput,
  ): Promise<PromotionPreviewRow[] | null> => {
    setPreviewError(null);
    try {
      return await previewMutation.mutateAsync({ id, body });
    } catch (error) {
      const description = detail(error);
      setPreviewError(description ?? t("sessions.rollover.previewFailed"));
      notify.error(t("sessions.rollover.previewFailed"), { description });
      return null;
    }
  };

  const start = async (id: string, body: SessionRolloverInput): Promise<boolean> => {
    setStartError(null);
    try {
      await startMutation.mutateAsync({ id, body });
      notify.success(t("sessions.rollover.started"));
      return true;
    } catch (error) {
      const description = detail(error);
      setStartError(description ?? t("sessions.rollover.startFailed"));
      notify.error(t("sessions.rollover.startFailed"), { description });
      return false;
    }
  };

  return {
    preview,
    start,
    previewError,
    startError,
    isPending: previewMutation.isPending || startMutation.isPending,
  };
}
