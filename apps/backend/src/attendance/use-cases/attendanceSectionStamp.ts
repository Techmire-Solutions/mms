import { attendanceCalendarRepository } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { todayInTimeZone } from "../../lib/dbDate.js";

interface SectionStampable {
  classId?: string | null;
  studentId?: string | null;
  sectionId?: string | null;
  date?: string | null;
}

export interface RejectedAttendanceStamp {
  studentId: string;
  classId: string;
  date: string;
  reason: "not_enrolled";
}

export interface AttendanceStampResult<T> {
  records: T[];
  /** Marks on/after today whose student has no live enrollment in the class. */
  rejected: RejectedAttendanceStamp[];
}

const keyOf = (record: { studentId?: string | null; classId?: string | null }) =>
  `${String(record.studentId)}:${String(record.classId)}`;

/**
 * Stamps each attendance row with the section of the student's placement **on that attendance
 * date** (falling back to the live enrollment for rows older than placement history), so the
 * row keeps its section of record after a later transfer. Client-sent values are ignored.
 *
 * Marks dated today or later additionally require a live enrollment in the class: the roster is
 * derived on the client, so a stale client must not be able to record attendance for a student
 * who was never (or is no longer) enrolled. Historical backfills are allowed.
 */
export async function stampAttendanceSections<T extends SectionStampable>(
  tenant: string,
  records: T[],
): Promise<AttendanceStampResult<T>> {
  const keyed = records.filter((record) => record.classId && record.studentId);
  if (keyed.length === 0) return { records, rejected: [] };
  const classIds = [...new Set(keyed.map((record) => String(record.classId)))];
  const studentIds = [...new Set(keyed.map((record) => String(record.studentId)))];

  // Live placements: also the "is the student enrolled right now?" answer.
  const live = await attendanceCalendarRepository.listEnrollmentPlacements(
    tenant,
    classIds,
    studentIds,
    { sectionedOnly: true },
  );
  const liveByKey = new Map(live.map((row) => [keyOf(row), row.sectionId]));

  // Dated placements: one lookup per distinct attendance date.
  const dates = [...new Set(keyed.map((record) => (record.date ?? "").slice(0, 10)))].filter(
    Boolean,
  );
  const sectionByDate = new Map<string, string | null>();
  for (const date of dates) {
    const rows = await attendanceCalendarRepository.listEnrollmentPlacementsAsOf(
      tenant,
      classIds,
      studentIds,
      date,
    );
    for (const row of rows) sectionByDate.set(`${date}:${keyOf(row)}`, row.sectionId);
  }

  const today = todayInTimeZone(await attendanceCalendarRepository.findWorkspaceTimezone(tenant));
  const rejected: RejectedAttendanceStamp[] = [];
  const stamped = records.map((record) => {
    if (!record.classId || !record.studentId) return record;
    const key = keyOf(record);
    const date = (record.date ?? "").slice(0, 10);
    const sectionId =
      (date ? sectionByDate.get(`${date}:${key}`) : null) ?? liveByKey.get(key) ?? null;
    if (date && date >= today && !liveByKey.has(key)) {
      rejected.push({
        studentId: String(record.studentId),
        classId: String(record.classId),
        date,
        reason: "not_enrolled",
      });
    }
    return { ...record, sectionId };
  });
  return { records: stamped, rejected };
}
