import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).registrationQueries;

export const ADMISSIONS_QUERY_KEY = ["enrollments", "admissions"] as const;

export function admissionsListQueryOptions(...args: any[]): any {
  return host()?.admissionsListQueryOptions?.(...args);
}

export function admissionsMetricsQueryOptions(...args: any[]): any {
  return host()?.admissionsMetricsQueryOptions?.(...args);
}

export function invalidateRegistrationQueries(...args: any[]): any {
  return host()?.invalidateRegistrationQueries?.(...args);
}

export function reviewApplicationsMutationOptions(...args: any[]): any {
  return host()?.reviewApplicationsMutationOptions?.(...args);
}

export const registrationQueries = {
  ADMISSIONS_QUERY_KEY,
  admissionsListQueryOptions,
  admissionsMetricsQueryOptions,
  invalidateRegistrationQueries,
  reviewApplicationsMutationOptions,
};

export default registrationQueries;
