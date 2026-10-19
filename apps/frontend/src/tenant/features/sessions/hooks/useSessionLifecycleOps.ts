import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionCancelBody, SessionPostponeBody } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  SESSION_ACTIVITY_QUERY_KEY,
  cancelSessionMutationOptions,
  postponeSessionMutationOptions,
  sessionActivityQueryOptions,
} from "@/lib/query/sessionLifecycleOpsQueries";
import { invalidateEnrollmentsQueries } from "@/tenant/hooks/collections/enrollments";
import { invalidateSessionsQueries } from "./invalidateSessionsQueries";

export function useSessionActivity(sessionId: string) {
  const { isAuthenticated } = useAuth();
  return useQuery(sessionActivityQueryOptions(sessionId, isAuthenticated));
}

const detail = (error: unknown) =>
  isApiError(error) && error.status < 500 ? error.message : undefined;

/** Cancel / postpone with call-site toasts; each resolves true when saved. */
export function useSessionLifecycleActions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const onSettled = () => {
    invalidateSessionsQueries(queryClient);
    invalidateEnrollmentsQueries(queryClient);
    void queryClient.invalidateQueries({ queryKey: SESSION_ACTIVITY_QUERY_KEY });
  };
  const cancelMutation = useMutation({ ...cancelSessionMutationOptions(), onSettled });
  const postponeMutation = useMutation({ ...postponeSessionMutationOptions(), onSettled });

  const cancel = async (id: string, body: SessionCancelBody): Promise<boolean> => {
    try {
      const { ended, billing } = await cancelMutation.mutateAsync({ id, body });
      notify.success(t("sessions.lifecycleOps.cancelled", { count: ended }), {
        description:
          billing.cancelled.length > 0
            ? t("enrollments.ops.invoicesCancelled", { count: billing.cancelled.length })
            : undefined,
      });
      if (billing.review.length > 0)
        notify.warning(t("enrollments.ops.invoicesNeedReview", { count: billing.review.length }), {
          description: billing.review
            .map((invoice) => invoice.invoiceNumber ?? invoice.id)
            .join(", "),
        });
      return true;
    } catch (error) {
      notify.error(t("sessions.lifecycleOps.cancelFailed"), { description: detail(error) });
      return false;
    }
  };

  const postpone = async (id: string, body: SessionPostponeBody): Promise<boolean> => {
    try {
      await postponeMutation.mutateAsync({ id, body });
      notify.success(t("sessions.lifecycleOps.postponed"));
      return true;
    } catch (error) {
      notify.error(t("sessions.lifecycleOps.postponeFailed"), { description: detail(error) });
      return false;
    }
  };

  return { cancel, postpone, isPending: cancelMutation.isPending || postponeMutation.isPending };
}
