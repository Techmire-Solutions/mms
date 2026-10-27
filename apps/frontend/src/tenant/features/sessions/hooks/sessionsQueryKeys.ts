import { SESSIONS_MODULE_MANIFEST } from "@mms/shared";

export const SESSIONS_QUERY_KEY = ["sessions", "list"] as const;
export const SESSIONS_METRICS_QUERY_KEY = ["sessions", "metrics"] as const;
export const SESSIONS_WIDGET_AGGREGATES_QUERY_KEY = [
  SESSIONS_MODULE_MANIFEST.collectionKey,
  "widget-aggregates",
] as const;
export const SESSIONS_REPORT_AGGREGATES_QUERY_KEY = [
  SESSIONS_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;
