import type { BackgroundJobRecord, StudentExportColumn, StudentsListQuery } from "@mms/contracts";
import { startServerModuleCsvExport } from "@mms/fe-core/lib/startServerModuleCsvExport";

export async function startServerStudentsCsvExport(options: {
  query: StudentsListQuery;
  columns: StudentExportColumn[];
  filename: string;
  label: string;
  ids?: Array<string | number>;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/students/export/csv",
    body: {
      query: options.query,
      columns: options.columns,
      filename: options.filename,
      label: options.label,
      ids: options.ids,
    },
  });
}
