import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/shared";

export const ENROLLMENTS_QUERY_KEY = ["enrollments", "list"] as const;
export const ENROLLMENTS_METRICS_QUERY_KEY = ["enrollments", "metrics"] as const;
export const ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY = [
  ENROLLMENTS_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;
export const ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY = [
  ENROLLMENTS_MODULE_MANIFEST.collectionKey,
  "widget-aggregates",
] as const;

/** Typed key factory for the enrollment surfaces (single source of query-key shape). */
export const enrollmentsKeys = {
  all: ["enrollments"] as const,
  listRoot: ENROLLMENTS_QUERY_KEY,
  list: (params: Record<string, unknown> = {}) => [...ENROLLMENTS_QUERY_KEY, params] as const,
  detail: (id: string) => [...ENROLLMENTS_QUERY_KEY, "detail", id] as const,
  placements: (id?: string) =>
    id ? (["enrollments", "placements", id] as const) : (["enrollments", "placements"] as const),
  metrics: ENROLLMENTS_METRICS_QUERY_KEY,
  reports: (comparison: unknown = null) =>
    [...ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY, comparison] as const,
  widgets: (signature: string) => [...ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY, signature] as const,
  admissions: (params: Record<string, unknown> = {}) =>
    ["enrollments", "admissions", "list", params] as const,
  admissionsMetrics: (sessionId = "") =>
    ["enrollments", "admissions", "metrics", sessionId] as const,
};
