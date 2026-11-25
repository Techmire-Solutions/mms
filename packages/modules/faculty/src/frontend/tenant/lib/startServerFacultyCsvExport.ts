import type { BackgroundJobRecord, FacultyExportColumn, FacultyListQuery } from "@mms/contracts";
import { startServerModuleCsvExport } from "@mms/fe-core/lib/startServerModuleCsvExport";

export async function startServerFacultyCsvExport(options: {
  query: FacultyListQuery;
  columns: FacultyExportColumn[];
  filename: string;
  label: string;
  ids?: Array<string | number>;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/faculty/export/csv",
    body: {
      query: options.query,
      columns: options.columns,
      filename: options.filename,
      label: options.label,
      ids: options.ids,
    },
  });
}
