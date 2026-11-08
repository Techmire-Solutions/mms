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
