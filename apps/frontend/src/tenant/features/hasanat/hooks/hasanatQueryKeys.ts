import { HASANAT_MODULE_MANIFEST } from "@mms/shared";

export const HASANAT_DENOMS_QUERY_KEY = ["hasanat", "denoms", "list"] as const;
export const HASANAT_BATCHES_QUERY_KEY = ["hasanat", "batches", "list"] as const;
export const HASANAT_DISTRIBUTIONS_QUERY_KEY = ["hasanat", "distributions", "list"] as const;
export const HASANAT_REDEMPTIONS_QUERY_KEY = ["hasanat", "redemptions", "list"] as const;
export const HASANAT_METRICS_QUERY_KEY = ["hasanat", "metrics"] as const;
export const HASANAT_REPORT_AGGREGATES_QUERY_KEY = [
  HASANAT_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;
