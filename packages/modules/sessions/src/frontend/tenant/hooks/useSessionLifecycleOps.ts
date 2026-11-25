import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionCancelBody, SessionPostponeBody } from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { isApiError } from "@mms/fe-core/api/errors";
import { notify } from "@mms/fe-core/notify";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  SESSION_ACTIVITY_QUERY_KEY,
  cancelSessionMutationOptions,
  postponeSessionMutationOptions,
  sessionActivityQueryOptions,
  type SessionOperationToken,
} from "../hooks/sessionLifecycleOpsQueries.js";
import { invalidateSessionDependents } from "./invalidateSessionDependents";

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
    invalidateSessionDependents(queryClient, { enrollments: true });
    void queryClient.invalidateQueries({ queryKey: SESSION_ACTIVITY_QUERY_KEY });
  };
  const cancelMutation = useMutation({ ...cancelSessionMutationOptions(), onSettled });
  const postponeMutation = useMutation({ ...postponeSessionMutationOptions(), onSettled });

  const cancel = async (
    id: string,
    body: SessionCancelBody,
    token?: SessionOperationToken,
  ): Promise<boolean> => {
    try {
      const { ended, billing } = await cancelMutation.mutateAsync({ id, body, token });
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

  const postpone = async (
    id: string,
    body: SessionPostponeBody,
    token?: SessionOperationToken,
  ): Promise<boolean> => {
    try {
      await postponeMutation.mutateAsync({ id, body, token });
      notify.success(t("sessions.lifecycleOps.postponed"));
      return true;
    } catch (error) {
      notify.error(t("sessions.lifecycleOps.postponeFailed"), { description: detail(error) });
      return false;
    }
  };

  return { cancel, postpone, isPending: cancelMutation.isPending || postponeMutation.isPending };
}
