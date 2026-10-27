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
