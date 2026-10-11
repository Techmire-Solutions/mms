import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_QUERY_KEY,
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/faculty/hooks/facultyQueryKeys";
import { FACULTY_PREFERENCES_QUERY_KEY } from "@/tenant/features/faculty/hooks/useFacultySetupConfig";
import { FACULTY_LOOKUPS_QUERY_KEY } from "@/tenant/features/faculty/hooks/useFacultyLookups";

/** Invalidate Faculty list/metrics/setup/lookups Query keys (mutations + live push). */
export const invalidateFacultyQueries = createModuleQueryInvalidator({
  list: FACULTY_QUERY_KEY,
  count: FACULTY_QUERY_KEY,
  metrics: FACULTY_METRICS_QUERY_KEY,
  widgetAggregates: FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: FACULTY_PREFERENCES_QUERY_KEY,
  lookups: FACULTY_LOOKUPS_QUERY_KEY,
});
