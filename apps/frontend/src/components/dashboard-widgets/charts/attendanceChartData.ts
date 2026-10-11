import { formatShortWeekdayLabels } from "@mms/shared";

export interface AttendancePoint {
  day: string;
  rate: number;
}

export function buildWeeklyAttendancePoints(
  attendanceRecords: Array<{ date?: string; status?: string }>,
): AttendancePoint[] {
  const uniqueDates = Array.from(
    new Set(
      attendanceRecords
        .map((attendanceRecord) => attendanceRecord.date)
        .filter((d): d is string => Boolean(d)),
    ),
  )
    .sort()
    .reverse()
    .slice(0, 7)
    .reverse();

  const dateStatsMap = new Map<string, { total: number; present: number }>();
  attendanceRecords.forEach((attendanceRecord) => {
    if (!attendanceRecord.date) return;
    let stats = dateStatsMap.get(attendanceRecord.date);
    if (!stats) {
      stats = { total: 0, present: 0 };
      dateStatsMap.set(attendanceRecord.date, stats);
    }
    stats.total += 1;
    if (attendanceRecord.status === "present" || attendanceRecord.status === "late") {
      stats.present += 1;
    }
  });

  const dayIndexRateMap = new Map<number, number>();
  uniqueDates.forEach((attendanceDate) => {
    const dateObj = new Date(attendanceDate);
    const dayIndex = (dateObj.getDay() + 6) % 7; // Mon=0, Sun=6
    const stats = dateStatsMap.get(attendanceDate);
    const rate = stats && stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    dayIndexRateMap.set(dayIndex, rate);
  });

  const days = formatShortWeekdayLabels();
  return days.map((dayLabel, index) => ({
    day: dayLabel,
    rate: dayIndexRateMap.get(index) ?? 0,
  }));
}
