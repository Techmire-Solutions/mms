import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";

export const ATTENDANCE_QUERY_KEY = ["attendance", "list"] as const;
export const ATTENDANCE_METRICS_QUERY_KEY = ["attendance", "metrics"] as const;
export const ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY = [
  ATTENDANCE_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;
