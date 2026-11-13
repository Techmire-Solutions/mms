import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateAttendanceQueries } from "./invalidateAttendanceQueries";
import {} from "./useAttendance";
import { attendanceQueryKeys } from "./attendanceQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import { EXAMINATIONS_ELIGIBILITY_QUERY_KEY } from "@/tenant/hooks/collections/examinations";

describe("invalidateAttendanceQueries utility", () => {
  it("invalidates the attendance root plus the cross-module widget/dashboard roots", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;

    invalidateAttendanceQueries(queryClient);

    const invalidatedKeys = vi
      .mocked(queryClient.invalidateQueries)
      .mock.calls.map(([options]) => options?.queryKey);
    // The root covers every attendance key by prefix (list, roster, metrics, reports, lifecycle,
    // lookups, preferences); the other two are the cross-module dashboard surfaces.
    expect(invalidatedKeys).toEqual([
      attendanceQueryKeys.all,
      DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
      DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
      EXAMINATIONS_ELIGIBILITY_QUERY_KEY,
    ]);
  });
});
