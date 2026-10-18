import type { VisualizerConfig } from "@/lib/reports/reportMetadata";

export interface AttendanceReportProps {
  filters: {
    class: string;
    student: string;
  };
  onEditVisual: (config: VisualizerConfig) => void;
}

export interface AttendanceSummaryItem {
  class: string;
  total: number;
  avgRate: number;
  perfectAttendance: number;
  belowThreshold: number;
}

export interface StudentAttendanceItem {
  studentName: string;
  class: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  rate: number;
}

export type RateBarRenderer = (rate: number) => React.JSX.Element;
