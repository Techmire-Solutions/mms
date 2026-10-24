import type { BackgroundJobRecord, ContactExportColumn, ContactsListQuery } from "@mms/shared";
import { startServerModuleCsvExport } from "@/lib/backgroundJobs/startServerModuleCsvExport";

export async function startServerContactsCsvExport(options: {
  query: ContactsListQuery;
  columns: ContactExportColumn[];
  filename: string;
  label: string;
  ids?: Array<string | number>;
  idempotencyKey?: string;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/contacts/export/csv",
    body: {
      query: options.query,
      columns: options.columns,
      filename: options.filename,
      label: options.label,
      ids: options.ids && options.ids.length > 0 ? options.ids : undefined,
      idempotencyKey: options.idempotencyKey,
    },
  });
}
