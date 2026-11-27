export const OBLIGATIONS_TYPES_QUERY_KEY = ["obligations", "types", "list"] as const;
export const OBLIGATIONS_MUJTAHIDS_QUERY_KEY = ["obligations", "mujtahids", "list"] as const;
export const OBLIGATIONS_REPS_QUERY_KEY = ["obligations", "reps", "list"] as const;
export const OBLIGATIONS_WAKALA_QUERY_KEY = ["obligations", "wakala", "list"] as const;
export const OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY = [
  "obligations",
  "distributions",
  "list",
] as const;
export const OBLIGATIONS_COLLECTIONS_QUERY_KEY = ["obligations", "collections", "list"] as const;
export const OBLIGATIONS_METRICS_QUERY_KEY = ["obligations", "metrics"] as const;
export const OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY = [
  "obligations",
  "report-aggregates",
] as const;
/**
 * The posted journal entry behind one receipt.
 *
 * Must stay inside the `["obligations", …]` hierarchy: as `["obligation-voucher", id]` no
 * module-level invalidation could reach it, so an edit that reverses and reposts the entry left
 * the modal showing the previous voucher for its whole staleTime (frontend audit F2).
 */
export const OBLIGATIONS_VOUCHER_QUERY_KEY = ["obligations", "voucher"] as const;

/** Every key the module declares; the invalidator coverage test iterates this. */
export const OBLIGATIONS_QUERY_KEYS = {
  types: OBLIGATIONS_TYPES_QUERY_KEY,
  mujtahids: OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  reps: OBLIGATIONS_REPS_QUERY_KEY,
  wakala: OBLIGATIONS_WAKALA_QUERY_KEY,
  distributions: OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  collections: OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  metrics: OBLIGATIONS_METRICS_QUERY_KEY,
  reportAggregates: OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY,
  voucher: OBLIGATIONS_VOUCHER_QUERY_KEY,
} as const;
