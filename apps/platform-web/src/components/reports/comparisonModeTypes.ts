export interface ComparisonDataItem {
  metric: string;
  a: number;
  b: number;
  metricKey?: string;
}

export interface DateRangeDataItem {
  month: string;
  a: number;
  b: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface ComparisonModeProps {
  category: string;
  onClose: () => void;
}
