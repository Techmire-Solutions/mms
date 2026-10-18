import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegistrationApplicationListQuery, RegistrationReview } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  admissionsListQueryOptions,
  admissionsMetricsQueryOptions,
  invalidateRegistrationQueries,
  reviewApplicationsMutationOptions,
} from "@/lib/query/registrationQueries";
import { invalidateEnrollmentsQueries } from "./invalidateEnrollmentsQueries";

export function useAdmissionsList(query: RegistrationApplicationListQuery) {
  const { isAuthenticated } = useAuth();
  return useQuery(admissionsListQueryOptions(query, isAuthenticated));
}

export function useAdmissionsMetrics(sessionId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery(admissionsMetricsQueryOptions(sessionId, isAuthenticated));
}

/** Review decisions with call-site toasts; resolves true when every application was updated. */
export function useAdmissionsReview() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...reviewApplicationsMutationOptions(),
    onSettled: () => {
      invalidateRegistrationQueries(queryClient);
      invalidateEnrollmentsQueries(queryClient);
    },
  });

  const review = async (body: RegistrationReview): Promise<boolean> => {
    try {
      const result = await mutation.mutateAsync(body);
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
          description: result.failures[0]?.message,
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
