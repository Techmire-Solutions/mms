import { createAttendanceMarkUseCases } from "./attendanceMarkUseCases.js";
import { createAttendanceTrashUseCases } from "./attendanceTrashUseCases.js";
import type { AttendanceMutationDeps } from "./attendanceUseCaseSupport.js";

export type { AttendanceMutationDeps } from "./attendanceUseCaseSupport.js";

/**
 * Attendance write use-cases: marking (create / correct / bulk upsert) and the trash lifecycle.
 *
 * Split into two modules for the 300-line band; this keeps the composition root importing one
 * object. `replaceAttendanceRecords` is deliberately absent: the workspace-wide hard-delete replace
 * is only valid inside the backup-restore mirror, which calls the repository directly.
 */
export function createAttendanceMutationUseCases(deps: AttendanceMutationDeps) {
  return {
    ...createAttendanceMarkUseCases(deps),
    ...createAttendanceTrashUseCases(deps),
  };
}
