import { useQueryClient } from "@tanstack/react-query";
import type { AttendanceLeave } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { invalidateAttendanceQueries } from "@/tenant/features/attendance/hooks/invalidateAttendanceQueries";

/**
 * Excuse / leave workflow + chronic-absence alerts.
 *
 * Both surfaces are attendance-owned but separate from the marking grid, so their queries share one
 * key prefix and invalidate together after any decision.
 */

export const ATTENDANCE_LIFECYCLE_QUERY_KEY = ["attendance", "lifecycle"] as const;

/** Chronic-absence alert row as the contract returns it. */
export interface AttendanceAlertRow {
  id: string;
  classId: string;
  studentId: string;
  streakStart: string;
  streakEnd: string;
  streakLength: number;
  threshold: number;
  status: "open" | "resolved" | "dismissed";
  notifiedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

function invalidation() {
  return { queryKey: ATTENDANCE_LIFECYCLE_QUERY_KEY };
}

/**
 * A decision changes marks as well as the request: approving converts the covered absences, so the
 * attendance list/roster/metrics must refresh even when the websocket push is unavailable.
 */
function invalidateDecisionCaches(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries(invalidation());
  invalidateAttendanceQueries(queryClient);
}

export function useAttendanceExcuses() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const leaves = tsrClient.attendance.listLeaves.useQuery({
    queryKey: [...ATTENDANCE_LIFECYCLE_QUERY_KEY, "leaves"],
    query: {},
  });

  const invalidate = () => queryClient.invalidateQueries(invalidation());

  const submit = tsrClient.attendance.submitLeave.useMutation({
    onSuccess: () => {
      invalidate();
      notify.success(t("attendance.excuses.submitted"));
    },
    onError: (error: unknown) =>
      notify.error(t("attendance.excuses.submitFailed"), {
        description: error instanceof Error ? error.message : String(error),
      }),
  });

  const review = tsrClient.attendance.reviewLeave.useMutation({
    onSuccess: () => {
      invalidateDecisionCaches(queryClient);
      notify.success(t("attendance.excuses.decided"));
    },
    onError: (error: unknown) =>
      notify.error(t("attendance.excuses.decisionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      }),
  });

  const cancel = tsrClient.attendance.cancelLeave.useMutation({
    onSuccess: () => {
      invalidateDecisionCaches(queryClient);
      notify.success(t("attendance.excuses.cancelled"));
    },
    onError: (error: unknown) =>
      notify.error(t("attendance.excuses.cancelFailed"), {
        description: error instanceof Error ? error.message : String(error),
      }),
  });

  return {
    leaves: (leaves.data?.body.leaves ?? []) as AttendanceLeave[],
    isLoading: leaves.isLoading,
    isError: Boolean(leaves.error),
    submit,
    review,
    cancel,
  };
}

export function useAttendanceAbsenceAlerts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const alerts = tsrClient.attendance.listAbsenceAlerts.useQuery({
    queryKey: [...ATTENDANCE_LIFECYCLE_QUERY_KEY, "alerts"],
    query: {},
  });

  const invalidate = () => queryClient.invalidateQueries(invalidation());

  const scan = tsrClient.attendance.scanAbsenceStreaks.useMutation({
    onSuccess: () => {
      invalidate();
      notify.success(t("attendance.alerts.scanned"));
    },
  });

  const resolve = tsrClient.attendance.resolveAbsenceAlert.useMutation({
    onSuccess: () => {
      invalidateDecisionCaches(queryClient);
      notify.success(t("attendance.alerts.resolved"));
    },
    onError: (error: unknown) =>
      notify.error(t("attendance.alerts.resolveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      }),
  });

  return {
    alerts: (alerts.data?.body.alerts ?? []) as AttendanceAlertRow[],
    isLoading: alerts.isLoading,
    isError: Boolean(alerts.error),
    scan,
    resolve,
  };
}
