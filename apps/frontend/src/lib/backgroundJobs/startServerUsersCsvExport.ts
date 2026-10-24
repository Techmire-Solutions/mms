import type { BackgroundJobRecord, UserExportColumn, UsersListQuery } from "@mms/shared";
import { startServerModuleCsvExport } from "@/lib/backgroundJobs/startServerModuleCsvExport";

export async function startServerUsersCsvExport(options: {
  query: UsersListQuery;
  columns: UserExportColumn[];
  filename: string;
  label: string;
  ids?: Array<string | number>;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/users/export/csv",
    body: {
      query: options.query,
      columns: options.columns,
      filename: options.filename,
      label: options.label,
      ids: options.ids,
    },
  });
}
