/**
 * @file reportFilterTypes.ts
 * @description Pure type definitions for report filter fields and states.
 */

export type ReportFilterFieldKey =
  "session" | "class" | "status" | "dateFrom" | "dateTo" | "student";

export interface ReportFilterFields extends Record<string, unknown> {
  session: string;
  class: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  student: string;
}
