import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import {
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/hasanat/hooks/hasanatQueryKeys";
import { HASANAT_PREFERENCES_QUERY_KEY } from "@/tenant/features/hasanat/hooks/useHasanatSetupConfig";

/**
 * Card writes (issue/edit/redeem/void/archive/bulk/import) change balances, the ledger, the metrics
 * strip and every award aggregate — but never the tenant's setup preferences, so that query is not
 * invalidated here (doing so refetched the setup screen on every single award).
 */
export const invalidateHasanatWorkQueries = createModuleQueryInvalidator({
  list: HASANAT_DISTRIBUTIONS_QUERY_KEY,
  lists: [
    HASANAT_DENOMS_QUERY_KEY,
    HASANAT_BATCHES_QUERY_KEY,
    HASANAT_REDEMPTIONS_QUERY_KEY,
    HASANAT_REPORT_AGGREGATES_QUERY_KEY,
  ],
  metrics: HASANAT_METRICS_QUERY_KEY,
  // Dashboard/report widgets aggregate over the same cards; without this they stayed stale until
  // the WebSocket echo arrived.
  widgetAggregates: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
});

/** Setup writes change the catalogue/preferences and therefore the configuration screens. */
export const invalidateHasanatSetupQueries = createModuleQueryInvalidator({
  list: HASANAT_DISTRIBUTIONS_QUERY_KEY,
  lists: [HASANAT_DENOMS_QUERY_KEY, HASANAT_BATCHES_QUERY_KEY],
  metrics: HASANAT_METRICS_QUERY_KEY,
  widgetAggregates: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: HASANAT_PREFERENCES_QUERY_KEY,
});

/**
 * Union used by the live-push dispatcher and cross-module consumers: a realtime event can come from
 * any Hasanat table, so it refreshes the setup queries too.
 */
export const invalidateHasanatQueries = createModuleQueryInvalidator({
  list: HASANAT_DISTRIBUTIONS_QUERY_KEY,
  lists: [
    HASANAT_DENOMS_QUERY_KEY,
    HASANAT_BATCHES_QUERY_KEY,
    HASANAT_REDEMPTIONS_QUERY_KEY,
    HASANAT_REPORT_AGGREGATES_QUERY_KEY,
  ],
  metrics: HASANAT_METRICS_QUERY_KEY,
  widgetAggregates: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: HASANAT_PREFERENCES_QUERY_KEY,
});
