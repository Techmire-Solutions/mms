import { createModuleQueryInvalidator } from "@mms/fe-core/query/createModuleQueryInvalidator";
import {
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_METRICS_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY,
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_VOUCHER_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
} from "./obligationsQueryKeys";
import { OBLIGATIONS_PREFERENCES_QUERY_KEY } from "./useObligationsSetupConfig";
import {
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
} from "../host/accountingCollection";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@mms/fe-core/query/dashboardQueryKeys";

/** Invalidate Obligations collections/metrics/setup Query keys. */
export const invalidateObligationsQueries = createModuleQueryInvalidator({
  list: OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  lists: [
    OBLIGATIONS_TYPES_QUERY_KEY,
    OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
    OBLIGATIONS_REPS_QUERY_KEY,
    OBLIGATIONS_WAKALA_QUERY_KEY,
    OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  ],
  metrics: OBLIGATIONS_METRICS_QUERY_KEY,
  // Reporting aggregates keep a 5-minute staleTime, and the voucher caches a posted journal entry
  // that an edit reverses and reposts — both must be invalidated with the list (frontend audit F1/F2).
  reports: OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY,
  lookups: OBLIGATIONS_VOUCHER_QUERY_KEY,
  // A receipt posts a journal entry and moves the accounting reports; both keep their
  // own cache and stayed stale after a collection write.
  related: [ACCOUNTING_ENTRIES_QUERY_KEY, ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY],
  dashboard: DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
  preferences: OBLIGATIONS_PREFERENCES_QUERY_KEY,
});
