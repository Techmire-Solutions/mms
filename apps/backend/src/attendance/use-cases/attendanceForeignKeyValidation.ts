/**
 * Attendance foreign-key validation: referenced student and class must exist and be active.
 * Extracted from the use-case composition root (ADR-001); the repository lookups stay lazily
 * imported so the dependency graph is unchanged.
 */
import { dedupeTrimmedIds, type AttendanceRecord } from "@mms/shared";

export interface AttendanceUseCasesDependencies {
  findStudentById?: (
    tenant: string,
    id: string,
  ) => Promise<{ id: string; deletedAt?: unknown } | null>;
  findSessionById?: (
    tenant: string,
    id: string,
  ) => Promise<{ id: string; deletedAt?: unknown } | null>;
  findStudentsByIds?: (
    tenant: string,
    ids: string[],
  ) => Promise<{ id: string; deletedAt?: unknown }[]>;
  findSessionsByIds?: (
    tenant: string,
    ids: string[],
  ) => Promise<{ id: string; deletedAt?: unknown }[]>;
}

/** Binds the archived-reference guards to the optional test overrides in {@link AttendanceUseCasesDependencies}. */
export function createAttendanceForeignKeyValidators(deps?: AttendanceUseCasesDependencies) {
  const validateActiveForeignKeys = async (tenant: string, record: Partial<AttendanceRecord>) => {
    if (record.studentId) {
      const getStudent =
        deps?.findStudentById ??
        (await import("../../db/repositories/studentRepositoryHydrate.js")).findStudentById;
      const student = await getStudent(tenant, record.studentId);
      if (!student || student.deletedAt) {
        const err = new Error("Referenced student is archived or does not exist");
        (err as Error & { statusCode: number }).statusCode = 400;
        throw err;
      }
    }
    if (record.classId) {
      const getSession =
        deps?.findSessionById ??
        (await import("../../db/repositories/sessionRepositoryHydrate.js")).findClassById;
      const session = await getSession(tenant, record.classId);
      if (!session || session.deletedAt) {
        const err = new Error("Referenced class is archived or does not exist");
        (err as Error & { statusCode: number }).statusCode = 400;
        throw err;
      }
    }
  };

  const validateBatchActiveForeignKeys = async (tenant: string, records: AttendanceRecord[]) => {
    const studentIds = dedupeTrimmedIds(records.map((r) => r.studentId).filter(Boolean));
    if (studentIds.length > 0) {
      const getStudents =
        deps?.findStudentsByIds ??
        (await import("../../db/repositories/studentRepository.js")).findStudentsByIds;
      const students = await getStudents(tenant, studentIds);
      const activeStudentIds = new Set(students.filter((s) => !s.deletedAt).map((s) => s.id));
      for (const studentId of studentIds) {
        if (!activeStudentIds.has(studentId)) {
          const err = new Error("Referenced student is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
      }
    }
    const sessionIds = dedupeTrimmedIds(records.map((r) => r.classId).filter(Boolean));
    if (sessionIds.length > 0) {
      const sessionHydrate = await import("../../db/repositories/sessionRepositoryHydrate.js");
      const getSessions = deps?.findSessionsByIds ?? sessionHydrate.findClassesByIds;
      const sessions = await getSessions(tenant, sessionIds);
      const activeSessionIds = new Set(sessions.filter((s) => !s.deletedAt).map((s) => s.id));
      for (const sessionId of sessionIds) {
        if (!activeSessionIds.has(sessionId)) {
          const err = new Error("Referenced class is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
      }
    }
  };

  return { validateActiveForeignKeys, validateBatchActiveForeignKeys };
}
