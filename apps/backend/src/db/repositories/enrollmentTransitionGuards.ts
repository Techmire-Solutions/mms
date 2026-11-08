import { and, eq, inArray, isNull } from "drizzle-orm";
import { ENROLLMENT_OPERABLE_STATUSES } from "@mms/shared";
import { enrollments } from "../schema.js";
import { ConflictError } from "../../lib/httpErrors.js";

/**
 * Status predicates for the enrollment operation repositories.
 *
 * "Operable" (pending/confirmed) is not "seat-holding": `completed` deliberately counts as
 * a seat for capacity and revenue reporting, but it is history and must never be withdrawn,
 * cancelled or re-promoted by an operation. Putting the predicate in the UPDATE means two
 * concurrent operations cannot both win.
 */

const enrollmentKey = (subdomain: string, id: string) =>
  and(
    eq(enrollments.workspaceSubdomain, subdomain),
    eq(enrollments.id, id),
    isNull(enrollments.deletedAt),
  );

export const operableEnrollmentKey = (subdomain: string, id: string) =>
  and(enrollmentKey(subdomain, id), inArray(enrollments.status, [...ENROLLMENT_OPERABLE_STATUSES]));

export const NOT_OPERABLE =
  "This enrollment can no longer be changed because it is completed or otherwise finalised";

/** Refuses a transition whose guarded UPDATE matched no row (lost race or terminal row). */
export function assertChanged(count: number, message: string): void {
  if (count === 0) throw new ConflictError(message);
}

export interface OperationActor {
  userId: string | null;
  label: string;
}

export interface LiveEnrollmentRow {
  id: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  classId: string;
  sectionId: string | null;
  status: string;
}

export type EndedEnrollmentStatus =
  "withdrawn" | "cancelled" | "completed" | "promoted" | "retained" | "graduated" | "left";

export const ENDED_EVENT_LABEL: Record<EndedEnrollmentStatus, string> = {
  withdrawn: "Withdrawn",
  cancelled: "Cancelled with the session",
  completed: "Completed with the session",
  promoted: "Promoted to the next session",
  retained: "Retained for the next session",
  graduated: "Graduated",
  left: "Left at year end",
};
