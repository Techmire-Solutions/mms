import { useMemo } from 'react';
import { instructionalDayDecision, weekdayIndexes, type CalendarEventLite } from '@mms/shared';
import { useAttendanceConfig } from '@/hooks/useStandardModuleConfig';
import { useAcademicCalendarEvents } from './useAcademicCalendar';

export interface InstructionalDayInput {
  date: string;
  sessionId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  /** Session override of the weekly teaching days (empty = workspace default). */
  sessionWorkingDays?: readonly string[];
}

export interface InstructionalDayStatus {
  instructional: boolean;
  /** Holiday / make-up day deciding the date, if any. */
  event?: CalendarEventLite;
  /** Attendance policy allows marking non-teaching days as an audited extra class. */
  allowExtraClass: boolean;
  isLoading: boolean;
}

/** Same rule as the server guard (`@mms/shared` instructionalDayDecision) for the mark screen. */
export function useInstructionalDayStatus(input: InstructionalDayInput): InstructionalDayStatus {
  const { settings } = useAttendanceConfig();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(input.date);
  const query = useAcademicCalendarEvents({ from: input.date, to: input.date }, valid);
  const sessionDays = input.sessionWorkingDays;

  return useMemo(() => {
    const allowExtraClass = Boolean(settings.allowExtraClassOnHolidays);
    if (!valid) return { instructional: true, allowExtraClass, isLoading: false };
    const decision = instructionalDayDecision(input.date, {
      workingWeekdays: weekdayIndexes(sessionDays?.length ? sessionDays : settings.workingDays),
      events: query.data ?? [],
      scope: { sessionId: input.sessionId, classId: input.classId, sectionId: input.sectionId },
    });
    return { ...decision, allowExtraClass, isLoading: query.isLoading };
  }, [settings.allowExtraClassOnHolidays, settings.workingDays, valid, input.date, input.sessionId, input.classId, input.sectionId, sessionDays, query.data, query.isLoading]);
}
