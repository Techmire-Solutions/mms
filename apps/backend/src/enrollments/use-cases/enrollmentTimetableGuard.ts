import { findStudentTimetableCollisions, type Session } from "@mms/shared";
import { enrollmentOperationsRepository as repo } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import { ConflictError } from "../../lib/httpErrors.js";

/** Minimal shape of the timetable data both a hydrated session and a class carry. */
type TimetabledClass = {
  id: string;
  name?: string;
  timetables?: ReadonlyArray<{
    date?: string | null;
    periods?: ReadonlyArray<{
      startTime?: string | null;
      endTime?: string | null;
      facultyId?: string | null;
      subjectId?: string | null;
    }>;
  }>;
};

const toTimetableClass = (cls: TimetabledClass) => ({
  id: cls.id,
  name: cls.name,
  timetables: (cls.timetables ?? []).map((timetable) => ({
    date: timetable.date ?? null,
    periods: timetable.periods ?? [],
  })),
});

/**
 * A student cannot attend two classes at the same time.
 *
 * Within one session the live-enrollment unique index already prevents a second live
 * enrollment, but Sessions may overlap (`allowOverlap`), so two concurrent sessions can
 * book the same student into colliding slots. Checked at enrollment/transfer time only:
 * a later timetable edit is validated for the class/faculty, not retrospectively for every
 * enrolled student (documented residual gap).
 *
 * Gated by Sessions → `timetableConflictCheck` (default on).
 */
export async function assertNoStudentScheduleCollision(
  tenant: string,
  targetSession: Session,
  targetClassId: string,
  studentIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(studentIds.filter(Boolean))];
  if (ids.length === 0) return;
  const preferences = await repo.getSessionModulePreferencesByWorkspace(tenant);
  if (!(preferences?.timetableConflictCheck ?? true)) return;

  const targetClass = (targetSession.classes ?? []).find((cls) => cls.id === targetClassId);
  if (!targetClass || (targetClass.timetables ?? []).length === 0) return;

  const rows = await repo.listOperableEnrollments(tenant, { studentIds: ids });
  if (rows.length === 0) return;

  const byStudent = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    // A row in the target session cannot collide with itself (and the unique index means
    // there is at most one live row per student/session anyway).
    if (row.sessionId === targetSession.id) continue;
    const sessions = byStudent.get(row.studentId) ?? new Map<string, string[]>();
    sessions.set(row.sessionId, [...(sessions.get(row.sessionId) ?? []), row.classId]);
    byStudent.set(row.studentId, sessions);
  }

  const sessionCache = new Map<string, Session | null>();
  for (const [studentId, sessions] of byStudent) {
    for (const [sessionId, classIds] of sessions) {
      let otherSession = sessionCache.get(sessionId);
      if (otherSession === undefined) {
        otherSession = await repo.findSessionById(tenant, sessionId);
        sessionCache.set(sessionId, otherSession);
      }
      if (!otherSession) continue;
      const otherClasses = (otherSession.classes ?? []).filter((cls) => classIds.includes(cls.id));
      if (otherClasses.length === 0) continue;
      const [collision] = findStudentTimetableCollisions(
        toTimetableClass(targetClass as TimetabledClass),
        otherClasses.map((cls) => toTimetableClass(cls as TimetabledClass)),
      );
      if (collision) {
        throw new ConflictError(
          `Student ${studentId} already has a class in an overlapping time slot on ${collision.date}. ` +
            "Change the section/class or clear the conflicting timetable first.",
        );
      }
    }
  }
}
