import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegistrationApplicationListQuery, RegistrationReview } from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { isApiError } from "@mms/fe-core/api/errors";
import { notify } from "@mms/fe-core/notify";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  admissionsListQueryOptions,
  admissionsMetricsQueryOptions,
  invalidateRegistrationQueries,
  reviewApplicationsMutationOptions,
} from "../host/registrationQueries";
import { invalidateEnrollmentImpacts } from "../host/enrollmentImpactInvalidation";
import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";

export function useAdmissionsList(query: RegistrationApplicationListQuery) {
  const { isAuthenticated } = useAuth();
  return useQuery(admissionsListQueryOptions(query, isAuthenticated)) as any;
}

export function useAdmissionsMetrics(sessionId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery(admissionsMetricsQueryOptions(sessionId, isAuthenticated)) as any;
}

/** Review decisions with call-site toasts; resolves true when every application was updated. */
export function useAdmissionsReview() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...reviewApplicationsMutationOptions(),
    onSuccess: () => {
      invalidateRegistrationQueries(queryClient);
      invalidateEnrollmentImpacts(queryClient);
    },
  });

  const review = async (body: RegistrationReview): Promise<boolean> => {
    try {
      const result = (await mutation.mutateAsync(body as any)) as any;
      if (result.failures.length === 0) {
        notify.success(t("enrollments.admissions.reviewed", { count: result.updated }));
        return true;
      }
      notify.warning(
        t("enrollments.admissions.partial", {
          updated: result.updated,
          failed: result.failures.length,
        }),
        {
          description: translateValidationMessage(result.failures[0]?.message, t),
        },
      );
      return false;
    } catch (error) {
      notify.error(t("enrollments.admissions.reviewFailed"), {
        description: isApiError(error) ? error.message : undefined,
      });
      return false;
    }
  };

  return { review, isPending: mutation.isPending };
}
