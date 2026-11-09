import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient } from "@/lib/api";
import { attendanceQueryKeys } from "./attendanceQueryKeys.js";

/**
 * Server state of a roster day's submission.
 *
 * The grid used to keep "Submitted" in component state, so the badge vanished on reload and the
 * server-side lock was invisible. This reads the authoritative state (the API returns an unlocked
 * record when the day was never submitted).
 */
export function useAttendanceDaySubmission(classId: string, date: string, enabled = true) {
  const { isAuthenticated } = useAuth();
  const trimmedClass = classId.trim();
  const trimmedDate = date.trim();
  const query = tsrClient.attendance.getDaySubmission.useQuery({
    queryKey: attendanceQueryKeys.daySubmission(trimmedClass, trimmedDate),
    queryData: { params: { classId: trimmedClass, date: trimmedDate } },
    enabled: isAuthenticated && enabled && Boolean(trimmedClass && trimmedDate),
    staleTime: 15_000,
  });

  const submission =
    query.data?.status === 200
      ? (query.data.body.submission as {
          locked: boolean;
          submittedAt: string;
          submittedBy: string | null;
        })
      : null;

  return { submission, isLoading: query.isLoading, refetch: query.refetch };
}
