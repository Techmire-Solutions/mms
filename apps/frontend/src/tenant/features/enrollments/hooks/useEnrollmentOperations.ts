import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EnrollmentTransferBody, EnrollmentWithdrawBody } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import {
  ENROLLMENT_PLACEMENTS_QUERY_KEY,
  enrollmentPlacementsQueryOptions,
  transferEnrollmentMutationOptions,
  withdrawEnrollmentMutationOptions,
} from "@/lib/query/enrollmentOperationsQueries";
import { invalidateSessionsQueries } from "@/tenant/hooks/collections/sessions";
import { invalidateEnrollmentsQueries } from "./invalidateEnrollmentsQueries";

export function useEnrollmentPlacements(enrollmentId: string) {
  const { isAuthenticated } = useAuth();
  return useQuery(enrollmentPlacementsQueryOptions(enrollmentId, isAuthenticated));
}

const detail = (error: unknown) =>
  isApiError(error) && error.status >= 400 && error.status < 500 ? error.message : undefined;

/** Transfer / withdraw with call-site toasts; each resolves true when the change was saved. */
export function useEnrollmentOperations() {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const queryClient = useQueryClient();
  const onSettled = () => {
    invalidateEnrollmentsQueries(queryClient);
    invalidateSessionsQueries(queryClient);
    void queryClient.invalidateQueries({ queryKey: ENROLLMENT_PLACEMENTS_QUERY_KEY });
  };
  const transferMutation = useMutation({ ...transferEnrollmentMutationOptions(), onSettled });
  const withdrawMutation = useMutation({ ...withdrawEnrollmentMutationOptions(), onSettled });

  const transfer = async (id: string, body: EnrollmentTransferBody): Promise<boolean> => {
    try {
      const moved = await transferMutation.mutateAsync({ id, body });
      notify.success(t("enrollments.ops.transferred"), {
        description: t("enrollments.ops.feeFromNextPeriod", {
          amount: formatCurrency(moved.finalFee),
        }),
      });
      return true;
    } catch (error) {
      notify.error(t("enrollments.ops.transferFailed"), { description: detail(error) });
      return false;
    }
  };

  const withdraw = async (id: string, body: EnrollmentWithdrawBody): Promise<boolean> => {
    try {
      const { billing } = await withdrawMutation.mutateAsync({ id, body });
      notify.success(t("enrollments.ops.withdrawnToast"), {
        description:
          billing.cancelled.length > 0
            ? t("enrollments.ops.invoicesCancelled", { count: billing.cancelled.length })
            : undefined,
      });
      if (billing.review.length > 0) {
        notify.warning(t("enrollments.ops.invoicesNeedReview", { count: billing.review.length }), {
          description: billing.review
            .map((invoice) => invoice.invoiceNumber ?? invoice.id)
            .join(", "),
        });
      }
      return true;
    } catch (error) {
      notify.error(t("enrollments.ops.withdrawFailed"), { description: detail(error) });
      return false;
    }
  };

  return {
    transfer,
    withdraw,
    isPending: transferMutation.isPending || withdrawMutation.isPending,
  };
}
