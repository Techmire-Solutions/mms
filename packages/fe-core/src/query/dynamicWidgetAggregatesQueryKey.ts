/**
 * Query key for the Reports "dynamic widget aggregates" endpoint.
 *
 * Lives in its own module (not in the hook) so the central invalidation
 * dispatcher can invalidate it without pulling the hook — and its auth/contract
 * imports — into the WebSocket chunk.
 *
 * Every field the request body carries is part of the signature: the key used to
 * omit `xAxisField` and `chartLimit`, so editing a widget's axis or chart limit
 * silently reused the previous aggregate.
 */
export const DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY = ["dynamic_widget_aggregates"] as const;

export interface DynamicWidgetAggregateSignature {
  id: string;
  collection: string;
  operation: string;
  targetField?: string;
  filterField?: string;
  filterOperator?: string;
  filterValue?: string;
  xAxisField?: string;
  chartLimit?: number;
}

export function dynamicWidgetAggregatesQueryKey(
  widgets: readonly DynamicWidgetAggregateSignature[],
): readonly [string, string] {
  const signature = JSON.stringify(
    widgets
      .map((widget) => ({
        id: widget.id,
        col: widget.collection,
        op: widget.operation,
        tf: widget.targetField,
        ff: widget.filterField,
        fo: widget.filterOperator,
        fv: widget.filterValue,
        xa: widget.xAxisField,
        cl: widget.chartLimit,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
  return [DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY[0], signature] as const;
}
