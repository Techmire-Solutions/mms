import { attendanceCalendarRepository as repo } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";

/**
 * Attendance-owned write for an approved leave range (used by enrollment suspension). Approved
 * leave days are excluded from attendance rates by the countable-attendance rule.
 */
export async function recordApprovedLeave(
  tenant: string,
  leave: { studentId: string; fromOn: string; toOn: string; reason: string; approvedBy: string },
): Promise<string> {
  const overlapping = await repo.findOverlappingApprovedLeaves(
    tenant,
    leave.studentId,
    leave.fromOn,
    leave.toOn,
  );
  if (overlapping.length > 0) {
    const [first] = overlapping;
    throw new ConflictError(
      `The student already has approved leave from ${first.fromDate} to ${first.toDate}`,
    );
  }
  const id = await repo.insertApprovedLeave(tenant, leave);
  await broadcastCollection("attendance");
  return id;
}
