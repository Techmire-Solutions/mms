import { FINANCE_MODULE_MANIFEST } from "@mms/shared";

export const FINANCE_INVOICES_QUERY_KEY = ["finance", "invoices", "list"] as const;
export const FINANCE_PAYMENTS_QUERY_KEY = ["finance", "payments", "list"] as const;
export const FINANCE_METRICS_QUERY_KEY = ["finance", "metrics"] as const;
export const FINANCE_REPORT_AGGREGATES_QUERY_KEY = [
  FINANCE_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;
export const FINANCE_FIELD_CONFIG_QUERY_KEY = ["finance", "field-config", "contract"] as const;
export const FINANCE_PREFERENCES_QUERY_KEY = ["finance", "preferences", "contract"] as const;
