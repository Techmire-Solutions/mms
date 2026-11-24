/** Single registry for every Sessions query family (feature hooks + lib query factories). */
export const SESSIONS_QUERY_KEY = ["sessions", "list"] as const;
export const SESSION_DETAIL_QUERY_KEY = ["sessions", "detail"] as const;
export const SESSIONS_METRICS_QUERY_KEY = ["sessions", "metrics"] as const;
export const SESSIONS_WIDGET_AGGREGATES_QUERY_KEY = ["sessions", "widget-aggregates"] as const;
export const SESSIONS_REPORT_AGGREGATES_QUERY_KEY = ["sessions", "report-aggregates"] as const;
export const SESSION_ACTIVITY_QUERY_KEY = ["sessions", "activity"] as const;
export const SESSION_COMPLETION_QUERY_KEY = ["sessions", "completion"] as const;
export const SESSION_ROLLOVER_RUNS_QUERY_KEY = ["sessions", "rollover-runs"] as const;
