import type { QueryClient } from "@tanstack/react-query";
import { invalidateAcademicCalendarQueries } from "@/lib/query/academicCalendarQueries";
import { invalidateEnrollmentsQueries } from "@/tenant/hooks/collections/enrollments";
import { invalidateSessionsQueries } from "./invalidateSessionsQueries";

export interface SessionDependentInvalidation {
  /** Enrollment rows/seat counts change (create/update/delete/status/rollover/completion). */
  enrollments?: boolean;
  /** Academic-calendar rows cascade with the session (delete/restore/rollover copy). */
  calendar?: boolean;
}

/** Invalidate Sessions plus the cross-module caches a session mutation can change. */
export function invalidateSessionDependents(
  queryClient: QueryClient,
  options: SessionDependentInvalidation = {},
): void {
  invalidateSessionsQueries(queryClient);
  if (options.enrollments !== false) invalidateEnrollmentsQueries(queryClient);
  if (options.calendar) invalidateAcademicCalendarQueries(queryClient);
}
