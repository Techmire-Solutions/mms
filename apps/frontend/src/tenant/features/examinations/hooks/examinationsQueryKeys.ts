export const EXAMINATIONS_EXAMS_QUERY_KEY = ["examinations", "exams", "list"] as const;
export const EXAMINATIONS_RESULTS_QUERY_KEY = ["examinations", "results", "list"] as const;
export const EXAMINATIONS_METRICS_QUERY_KEY = ["examinations", "metrics"] as const;

/** Reports-tab analytics (always-returned server aggregates). */
export const EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY = [
  "examinations",
  "report-aggregates",
] as const;
