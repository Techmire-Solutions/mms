import { useMemo } from "react";
import {
  ATTENDANCE_MODULE_MANIFEST,
  listInstructionalDays,
  unmarkedInstructionalDays,
  weekdayIndexes,
} from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useAttendanceConfig } from "@/hooks/useStandardModuleConfig";
import { useAcademicCalendarEvents } from "./useAcademicCalendar";

export const ATTENDANCE_MARKED_DATES_QUERY_KEY = [
  ATTENDANCE_MODULE_MANIFEST.collectionKey,
  "marked-dates",
] as const;

export interface AttendanceCoverageInput {
  from: string;
  to: string;
  sessionId?: string;
  classId?: string;
  sectionId?: string;
  /** Session override of the weekly teaching days (empty = workspace default). */
  sessionWorkingDays?: readonly string[];
}

export interface AttendanceCoverageResult {
  /** Teaching days in range with no attendance row at all. */
  unmarkedDays: string[];
  instructionalDayCount: number;
  markedDayCount: number;
  isLoading: boolean;
  isError: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Teaching days in a range that nobody marked attendance for.
 *
 * The teaching-day set is derived client-side with the same shared rule the mark screen and the
 * server guard use, so the calendar and this report can never disagree. Only the marked-day set
 * comes from the server.
 */
export function useAttendanceCoverage(input: AttendanceCoverageInput): AttendanceCoverageResult {
  const { isAuthenticated } = useAuth();
  const { settings } = useAttendanceConfig();
  const valid = ISO_DATE.test(input.from) && ISO_DATE.test(input.to) && input.from <= input.to;

  const events = useAcademicCalendarEvents({ from: input.from, to: input.to }, valid);
  const marked = tsrClient.attendance.markedDates.useQuery({
    queryKey: [
      ...ATTENDANCE_MARKED_DATES_QUERY_KEY,
      input.from,
      input.to,
      input.classId ?? null,
      input.sectionId ?? null,
    ] as const,
    queryData: {
      query: {
        from: input.from,
        to: input.to,
        classId: input.classId?.trim() || undefined,
        sectionId: input.sectionId?.trim() || undefined,
      },
    },
    enabled: isAuthenticated && valid,
    staleTime: 30_000,
  });

  const markedDates = useMemo(
    () => (marked.data?.status === 200 ? marked.data.body.dates : []),
    [marked.data],
  );
  const sessionDays = input.sessionWorkingDays;

  return useMemo(() => {
    if (!valid) {
      return {
        unmarkedDays: [],
        instructionalDayCount: 0,
        markedDayCount: 0,
        isLoading: false,
        isError: false,
      };
    }
    const instructionalDays = listInstructionalDays(input.from, input.to, {
      workingWeekdays: weekdayIndexes(sessionDays?.length ? sessionDays : settings.workingDays),
      events: events.data ?? [],
      scope: {
        sessionId: input.sessionId ?? null,
        classId: input.classId ?? null,
        sectionId: input.sectionId ?? null,
      },
    });
    return {
      unmarkedDays: unmarkedInstructionalDays(instructionalDays, markedDates),
      instructionalDayCount: instructionalDays.length,
      markedDayCount: markedDates.length,
      isLoading: events.isLoading || marked.isLoading,
      isError: events.isError || marked.isError,
    };
  }, [
    valid,
    input.from,
    input.to,
    input.sessionId,
    input.classId,
    input.sectionId,
    sessionDays,
    settings.workingDays,
    events.data,
    events.isLoading,
    events.isError,
    markedDates,
    marked.isLoading,
    marked.isError,
  ]);
}
