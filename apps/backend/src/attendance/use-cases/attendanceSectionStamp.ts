import { attendanceCalendarRepository } from "../repository/attendanceCalendarRepositoryAdapter.js";

interface SectionStampable {
  classId?: string | null;
  studentId?: string | null;
  sectionId?: string | null;
}

/**
 * Stamps each attendance row with the section of the student's enrollment in that class, so the
 * row keeps its section of record after a later transfer. Client-sent values are ignored.
 */
export async function stampAttendanceSections<T extends SectionStampable>(
  tenant: string,
  records: T[],
): Promise<T[]> {
  const keyed = records.filter((record) => record.classId && record.studentId);
  if (keyed.length === 0) return records;
  const classIds = [...new Set(keyed.map((record) => String(record.classId)))];
  const studentIds = [...new Set(keyed.map((record) => String(record.studentId)))];
  const rows = await attendanceCalendarRepository.listEnrollmentPlacements(
    tenant,
    classIds,
    studentIds,
    { sectionedOnly: true },
  );
  const sectionOf = new Map(rows.map((row) => [`${row.studentId}:${row.classId}`, row.sectionId]));
  return records.map((record) =>
    record.classId && record.studentId
      ? { ...record, sectionId: sectionOf.get(`${record.studentId}:${record.classId}`) ?? null }
      : record,
  );
}
