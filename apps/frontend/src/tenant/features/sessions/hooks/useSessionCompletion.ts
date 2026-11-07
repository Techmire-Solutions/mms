import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  SESSION_COMPLETION_QUERY_KEY,
  evaluateCompletionMutationOptions,
  issueCertificatesMutationOptions,
  sessionCompletionQueryOptions,
} from "@/lib/query/sessionCompletionQueries";
import { invalidateSessionDependents } from "./invalidateSessionDependents";

export function useSessionCompletion(sessionId: string) {
  const { isAuthenticated } = useAuth();
  return useQuery(sessionCompletionQueryOptions(sessionId, isAuthenticated));
}

const detail = (error: unknown) =>
  isApiError(error) && error.status < 500 ? error.message : undefined;

/** Evaluate completion / issue certificates with call-site toasts. */
export function useSessionCompletionActions(sessionId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const onSettled = () => {
    invalidateSessionDependents(queryClient, { enrollments: true });
    void queryClient.invalidateQueries({ queryKey: SESSION_COMPLETION_QUERY_KEY });
  };
  const evaluateMutation = useMutation({ ...evaluateCompletionMutationOptions(), onSettled });
  const certificatesMutation = useMutation({ ...issueCertificatesMutationOptions(), onSettled });

  const evaluate = async (): Promise<void> => {
    try {
      const rows = await evaluateMutation.mutateAsync(sessionId);
      notify.success(
        t("sessions.completion.evaluated", {
          count: rows.filter((row) => row.status === "completed").length,
        }),
      );
    } catch (error) {
      notify.error(t("sessions.completion.evaluateFailed"), { description: detail(error) });
    }
  };

  const issueCertificates = async (enrollmentIds: string[]): Promise<string[]> => {
    try {
      const { issued } = await certificatesMutation.mutateAsync({
        id: sessionId,
        body: { enrollmentIds },
      });
      notify.success(t("sessions.completion.certificatesIssued", { count: issued.length }));
      return issued;
    } catch (error) {
      notify.error(t("sessions.completion.certificatesFailed"), { description: detail(error) });
      return [];
    }
  };

  return {
    evaluate,
    issueCertificates,
    isPending: evaluateMutation.isPending || certificatesMutation.isPending,
  };
}
