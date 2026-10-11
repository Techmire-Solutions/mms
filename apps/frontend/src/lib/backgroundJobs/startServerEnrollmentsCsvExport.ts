import type {
  BackgroundJobRecord,
  EnrollmentExportColumn,
  EnrollmentsListQuery,
} from "@mms/shared";
import { startServerModuleCsvExport } from "@/lib/backgroundJobs/startServerModuleCsvExport";

export async function startServerEnrollmentsCsvExport(options: {
  query: EnrollmentsListQuery;
  columns: EnrollmentExportColumn[];
  filename: string;
  label: string;
  ids?: Array<string | number>;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/enrollments/export/csv",
    body: {
      query: options.query,
      columns: options.columns,
      filename: options.filename,
      label: options.label,
      ids: options.ids,
    },
  });
}
