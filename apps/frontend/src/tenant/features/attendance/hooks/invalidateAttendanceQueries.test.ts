import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateAttendanceQueries } from "./invalidateAttendanceQueries";
import {
  ATTENDANCE_METRICS_QUERY_KEY,
  ATTENDANCE_QUERY_KEY,
  ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "./useAttendance";
import { ATTENDANCE_LOOKUPS_QUERY_KEY } from "./useAttendanceLookups";
import { ATTENDANCE_PREFERENCES_QUERY_KEY } from "./useAttendanceSetupConfig";

describe("invalidateAttendanceQueries utility", () => {
  it("invalidates the list, metrics, report aggregates, setup and lookups keys", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;

    invalidateAttendanceQueries(queryClient);

    const invalidatedKeys = vi
      .mocked(queryClient.invalidateQueries)
      .mock.calls.map(([options]) => options?.queryKey);
    expect(invalidatedKeys).toEqual([
      ATTENDANCE_QUERY_KEY,
      ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
      ATTENDANCE_METRICS_QUERY_KEY,
      ATTENDANCE_PREFERENCES_QUERY_KEY,
      ATTENDANCE_LOOKUPS_QUERY_KEY,
    ]);
  });
});
