import type { AttendanceReportAggregates, AttendanceReportComparisonQuery } from "@mms/shared";
import { normalizeAttendanceReportComparisonQuery } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { useAuth } from "@/lib/contexts/AuthContext";

import { ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY } from "./attendanceQueryKeys.js";

export { ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY };

export function useAttendanceReportAggregates(options?: {
  enabled?: boolean;
  classId?: string;
  comparison?: AttendanceReportComparisonQuery;
}) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  const comparison = normalizeAttendanceReportComparisonQuery(options?.comparison);
  const classId = options?.classId?.trim() || undefined;
  const query = tsrClient.attendance.reportAggregates.useQuery({
    queryKey: [
      ...ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
      classId ?? null,
      comparison ?? null,
    ] as const,
    queryData: {
      query: {
        classId,
        sessionIds: comparison?.sessionIds?.length ? comparison.sessionIds.join(",") : undefined,
        rangeAFrom: comparison?.rangeAFrom,
        rangeATo: comparison?.rangeATo,
        rangeBFrom: comparison?.rangeBFrom,
        rangeBTo: comparison?.rangeBTo,
      },
    },
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });

  return {
    ...query,
    data: query.data?.status === 200 ? (query.data.body as AttendanceReportAggregates) : undefined,
  };
}
