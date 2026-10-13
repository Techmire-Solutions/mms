import type { ReportCollection } from "@/lib/reports/reportMetadata";

export interface CollectionMeta {
  name: string;
  dbKey: string;
  defaultData: readonly unknown[];
  fields: readonly {
    readonly value: string;
    readonly label: string;
    readonly isNumeric?: boolean;
  }[];
  numericFields: readonly { readonly value: string; readonly label: string }[];
}

export interface FilterRule {
  id: string;
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "startsWith";
  value: string;
}

export interface CustomWidget {
  id: string;
  title: string;
  category: string;
  collection: ReportCollection;
  chartType: "bar" | "line" | "area" | "pie" | "radar";
  xAxisField: string;
  operation: "count" | "sum" | "avg";
  targetField?: string;
  filterField?: string;
  filterOperator: "equals" | "contains" | "gt" | "lt";
  filterValue?: string;
  color: string;
  isPinnedToDashboard: boolean;
}

export interface AggregatedItem {
  name: string;
  value: number;
  count: number;
}

export type ChartOperation = "count" | "sum" | "avg" | "min" | "max";
export type ChartType = "bar" | "line" | "area" | "pie" | "radar";
