import { dedupeTrimmedIds, type AttendanceRecord } from "@mms/shared";
import type { AttendancePolicyStore } from "./attendancePolicyGuard.js";

/**
 * Attendance foreign-key validation: the referenced student and class must exist and be active.
 *
 * The lookups are **injected** — this module no longer reaches into `db/repositories` on its own
 * (that dynamically imported ORM repositories from inside the domain and made the DI seam
 * degenerate). `attendanceUseCases.ts` binds the Drizzle-backed references at the composition root;
 * tests bind fakes.
 */

type ArchivedRow = { id: string; deletedAt?: unknown };

export interface AttendanceReferenceLookups {
  findStudentById: (tenant: string, id: string) => Promise<ArchivedRow | null>;
  findSessionById: (tenant: string, id: string) => Promise<ArchivedRow | null>;
  findStudentsByIds: (tenant: string, ids: string[]) => Promise<ArchivedRow[]>;
  findSessionsByIds: (tenant: string, ids: string[]) => Promise<ArchivedRow[]>;
}

export interface AttendanceUseCasesDependencies extends Partial<AttendanceReferenceLookups> {
  /** Policy lookups (preferences, timezone, approved leave, submitted days). */
  policyStore?: AttendancePolicyStore;
}

function archivedReference(message: string): Error {
  const err = new Error(message);
  (err as Error & { statusCode: number }).statusCode = 400;
  return err;
}

/** Binds the archived-reference guards to the lookups resolved by the composition root. */
export function createAttendanceForeignKeyValidators(deps: AttendanceReferenceLookups) {
  const validateActiveForeignKeys = async (tenant: string, record: Partial<AttendanceRecord>) => {
    if (record.studentId) {
      const student = await deps.findStudentById(tenant, record.studentId);
      if (!student || student.deletedAt) {
        throw archivedReference("Referenced student is archived or does not exist");
      }
    }
    if (record.classId) {
      const session = await deps.findSessionById(tenant, record.classId);
      if (!session || session.deletedAt) {
        throw archivedReference("Referenced class is archived or does not exist");
      }
    }
  };

  const validateBatchActiveForeignKeys = async (tenant: string, records: AttendanceRecord[]) => {
    const studentIds = dedupeTrimmedIds(records.map((r) => r.studentId).filter(Boolean));
    if (studentIds.length > 0) {
      const students = await deps.findStudentsByIds(tenant, studentIds);
      const activeStudentIds = new Set(students.filter((s) => !s.deletedAt).map((s) => s.id));
      for (const studentId of studentIds) {
        if (!activeStudentIds.has(studentId)) {
          throw archivedReference("Referenced student is archived or does not exist");
        }
      }
    }
    const sessionIds = dedupeTrimmedIds(records.map((r) => r.classId).filter(Boolean));
    if (sessionIds.length > 0) {
      const sessions = await deps.findSessionsByIds(tenant, sessionIds);
      const activeSessionIds = new Set(sessions.filter((s) => !s.deletedAt).map((s) => s.id));
      for (const sessionId of sessionIds) {
        if (!activeSessionIds.has(sessionId)) {
          throw archivedReference("Referenced class is archived or does not exist");
        }
      }
    }
  };

  return { validateActiveForeignKeys, validateBatchActiveForeignKeys };
}
