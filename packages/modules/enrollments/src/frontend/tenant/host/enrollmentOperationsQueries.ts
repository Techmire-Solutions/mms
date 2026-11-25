import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).enrollmentOperationsQueries;

export const ENROLLMENT_PLACEMENTS_QUERY_KEY = ["enrollments", "placements"] as const;

export function enrollmentPlacementsQueryOptions(...args: any[]): any {
  return host()?.enrollmentPlacementsQueryOptions?.(...args);
}

export function bulkEndEnrollmentMutationOptions(...args: any[]): any {
  return host()?.bulkEndEnrollmentMutationOptions?.(...args);
}

export function readmitEnrollmentMutationOptions(...args: any[]): any {
  return host()?.readmitEnrollmentMutationOptions?.(...args);
}

export function suspendEnrollmentMutationOptions(...args: any[]): any {
  return host()?.suspendEnrollmentMutationOptions?.(...args);
}

export function transferEnrollmentMutationOptions(...args: any[]): any {
  return host()?.transferEnrollmentMutationOptions?.(...args);
}

export function withdrawEnrollmentMutationOptions(...args: any[]): any {
  return host()?.withdrawEnrollmentMutationOptions?.(...args);
}

export const enrollmentOperationsQueries = {
  ENROLLMENT_PLACEMENTS_QUERY_KEY,
  enrollmentPlacementsQueryOptions,
  bulkEndEnrollmentMutationOptions,
  readmitEnrollmentMutationOptions,
  suspendEnrollmentMutationOptions,
  transferEnrollmentMutationOptions,
  withdrawEnrollmentMutationOptions,
};

export default enrollmentOperationsQueries;
