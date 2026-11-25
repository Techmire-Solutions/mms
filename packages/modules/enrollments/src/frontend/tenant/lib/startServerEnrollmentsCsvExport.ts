import type {
  BackgroundJobRecord,
  EnrollmentExportColumn,
  EnrollmentsListQuery,
} from "@mms/contracts";
import { startServerModuleCsvExport } from "@mms/fe-core/lib/startServerModuleCsvExport";

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
