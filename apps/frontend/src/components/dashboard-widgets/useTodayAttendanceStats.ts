import React from "react";
import { todayISO } from "@mms/shared";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import type { Session } from "@/lib/data/sessionsData";

export interface ClassBreakdown {
  classId: string;
  name: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

export interface TodayAttendanceStats {
  displayRecords: AttendanceRecord[];
  displayDate: string;
  isToday: boolean;
  stats: Record<string, number>;
  rate: number;
  classBreakdown: ClassBreakdown[];
}

export function useTodayAttendanceStats(
  attendanceRecords: AttendanceRecord[],
  sessions: Session[],
): TodayAttendanceStats {
  const today = todayISO();

  return React.useMemo(() => {
    const classNameMap = new Map<string, string>();
    sessions.forEach((session) => {
      (session.classes || []).forEach((classInfo) => {
        if (classInfo.id && classInfo.name) {
          classNameMap.set(classInfo.id, classInfo.name);
        }
      });
    });

    const todayRecs = attendanceRecords.filter((rec) => rec.date === today);
    let dispRecs = todayRecs;
    if (dispRecs.length === 0) {
      const dates = Array.from(new Set(attendanceRecords.map((rec) => rec.date)))
        .sort()
        .reverse();
      dispRecs = dates.length > 0 ? attendanceRecords.filter((rec) => rec.date === dates[0]) : [];
    }

    const dispDate = dispRecs.length > 0 ? dispRecs[0].date : today;
    const isTod = dispDate === today;

    const counts: Record<string, number> = { total: dispRecs.length };
    dispRecs.forEach((rec) => {
      counts[rec.status] = (counts[rec.status] || 0) + 1;
    });

    const rRate = counts.total
      ? Math.round((((counts.present || 0) + (counts.late || 0)) / counts.total) * 100)
      : 0;

    const attendanceByClassId: Record<string, Record<string, number>> = {};
    dispRecs.forEach((rec) => {
      if (!attendanceByClassId[rec.classId]) attendanceByClassId[rec.classId] = { total: 0 };
      attendanceByClassId[rec.classId][rec.status] =
        (attendanceByClassId[rec.classId][rec.status] || 0) + 1;
      attendanceByClassId[rec.classId].total++;
    });

    const cBreakdown = Object.entries(attendanceByClassId).map(([classId, statusCounts]) => ({
      classId,
      name: classNameMap.get(classId) || classId,
      present: statusCounts.present || 0,
      absent: statusCounts.absent || 0,
      late: statusCounts.late || 0,
      excused: statusCounts.excused || 0,
      total: statusCounts.total,
      rate: statusCounts.total
        ? Math.round(
            (((statusCounts.present || 0) + (statusCounts.late || 0)) / statusCounts.total) * 100,
          )
        : 0,
    })) as ClassBreakdown[];

    return {
      displayRecords: dispRecs,
      displayDate: dispDate,
      isToday: isTod,
      stats: counts,
      rate: rRate,
      classBreakdown: cBreakdown,
    };
  }, [attendanceRecords, sessions, today]);
}
