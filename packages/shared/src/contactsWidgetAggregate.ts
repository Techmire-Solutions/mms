import type { WidgetQuery, WidgetAggregateResult, WidgetFilter } from "./widgetAggregateTypes.js";

export type ContactsWidgetOperation = "count" | "sum" | "avg" | "percentage";
export type ContactsWidgetFilterOperator = "equals" | "contains" | "startsWith" | "gt" | "lt";
export type ContactsWidgetFilter = WidgetFilter;

export type ContactsWidgetQuery = WidgetQuery;
export type ContactsWidgetAggregateResult = WidgetAggregateResult;

export function contactsWidgetQueryFromWidget(widget: {
  id: string;
  operation: ContactsWidgetOperation;
  targetField?: string;
  filterField?: string;
  filterOperator?: ContactsWidgetFilterOperator;
  filterValue?: string;
  xAxisField?: string;
  filters?: ContactsWidgetFilter[];
  chartLimit?: number;
}): ContactsWidgetQuery {
  return {
    id: widget.id,
    operation: widget.operation,
    targetField: widget.targetField,
    filterField: widget.filterField,
    filterOperator: widget.filterOperator,
    filterValue: widget.filterValue,
    xAxisField: widget.xAxisField,
    filters: widget.filters,
    chartLimit: widget.chartLimit,
  };
}
