import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AppTranslationKey,
  EnrollmentReadmitBody,
  EnrollmentSuspendBody,
  EnrollmentTransferBody,
  EnrollmentWithdrawBody,
} from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import {
  enrollmentPlacementsQueryOptions,
  bulkEndEnrollmentMutationOptions,
  readmitEnrollmentMutationOptions,
  suspendEnrollmentMutationOptions,
  transferEnrollmentMutationOptions,
  withdrawEnrollmentMutationOptions,
} from "@/lib/query/enrollmentOperationsQueries";
import { invalidateEnrollmentImpacts } from "@/lib/query/enrollmentImpactInvalidation";
import {
  optimisticEndEnrollments,
  rollbackEnrollmentSnapshots,
  type OptimisticEndContext,
} from "./optimisticEnrollmentCache";

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
  const moved = () =>
    invalidateEnrollmentImpacts(queryClient, { placements: true, dashboard: true });
  const ended = () =>
    invalidateEnrollmentImpacts(queryClient, {
      placements: true,
      finance: true,
      admissions: true,
      dashboard: true,
    });
  const transferMutation = useMutation({
    ...transferEnrollmentMutationOptions(),
    onSuccess: moved,
  });
  const withdrawMutation = useMutation({
    ...withdrawEnrollmentMutationOptions(),
    onMutate: (vars) =>
      optimisticEndEnrollments(queryClient, [vars.id], vars.body.endAs ?? "withdrawn"),
    onError: (_error, _vars, context) =>
      rollbackEnrollmentSnapshots(queryClient, context as OptimisticEndContext | undefined),
    onSuccess: ended,
  });
  const readmitMutation = useMutation({ ...readmitEnrollmentMutationOptions(), onSuccess: moved });
  const suspendMutation = useMutation({ ...suspendEnrollmentMutationOptions(), onSuccess: moved });
  const bulkEndMutation = useMutation({
    ...bulkEndEnrollmentMutationOptions(),
    onMutate: (vars) => optimisticEndEnrollments(queryClient, vars.ids, vars.endAs ?? "withdrawn"),
    onError: (_error, _vars, context) =>
      rollbackEnrollmentSnapshots(queryClient, context as OptimisticEndContext | undefined),
    onSuccess: ended,
  });

  const simple = async <B>(
    run: (input: { id: string; body: B }) => Promise<unknown>,
    id: string,
    body: B,
    keys: { ok: AppTranslationKey; failed: AppTranslationKey },
  ): Promise<boolean> => {
    try {
      await run({ id, body });
      notify.success(t(keys.ok));
      return true;
    } catch (error) {
      notify.error(t(keys.failed), { description: detail(error) });
      return false;
    }
  };
  const readmit = (id: string, body: EnrollmentReadmitBody) =>
    simple(readmitMutation.mutateAsync, id, body, {
      ok: "enrollments.ops.readmitted",
      failed: "enrollments.ops.readmitFailed",
    });
  const suspend = (id: string, body: EnrollmentSuspendBody) =>
    simple(suspendMutation.mutateAsync, id, body, {
      ok: "enrollments.ops.suspendedToast",
      failed: "enrollments.ops.suspendFailed",
    });

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

  /**
   * Bulk cancellation. Each row goes through the same side-effecting end path as a single
   * withdrawal; partial success is reported per row instead of the previous N raw status
   * writes.
   */
  const bulkEnd = async (
    ids: string[],
    body: { reason: string; endAs?: "withdrawn" | "cancelled"; effectiveOn?: string },
  ) => {
    try {
      const result = await bulkEndMutation.mutateAsync({ ids, ...body });
      if (result.failed > 0) {
        notify.warning(t("enrollments.ops.withdrawFailed"), {
          description: result.failures.map((failure) => failure.message).join("; "),
        });
      } else {
        notify.success(t("enrollments.toast.cancelled"));
      }
      return result;
    } catch (error) {
      notify.error(t("enrollments.ops.withdrawFailed"), { description: detail(error) });
      return null;
    }
  };

  return {
    transfer,
    withdraw,
    bulkEnd,
    readmit,
    suspend,
    isPending:
      transferMutation.isPending ||
      withdrawMutation.isPending ||
      bulkEndMutation.isPending ||
      readmitMutation.isPending ||
      suspendMutation.isPending,
  };
}
