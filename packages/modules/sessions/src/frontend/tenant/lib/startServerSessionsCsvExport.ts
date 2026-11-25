import type { BackgroundJobRecord, SessionExportColumn, SessionsListQuery } from "@mms/contracts";
import { startServerModuleCsvExport } from "@mms/fe-core/lib/startServerModuleCsvExport";

export async function startServerSessionsCsvExport(options: {
  query: SessionsListQuery;
  columns: SessionExportColumn[];
  filename: string;
  label: string;
  ids?: Array<string | number>;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/sessions/export/csv",
    body: {
      query: options.query,
      columns: options.columns,
      filename: options.filename,
      label: options.label,
      ids: options.ids,
    },
  });
}
