import type { BackgroundJobRecord } from "@mms/shared";
import { startServerModuleCsvExport } from "@/lib/backgroundJobs/startServerModuleCsvExport";

export async function startServerFacultyDepartmentCsvExport(options: {
  filename: string;
  label: string;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/faculty/departments/export/csv",
    body: {
      filename: options.filename,
      label: options.label,
    },
  });
}

export async function startServerFacultyDesignationCsvExport(options: {
  filename: string;
  label: string;
}): Promise<BackgroundJobRecord> {
  return startServerModuleCsvExport({
    path: "/api/faculty/designations/export/csv",
    body: {
      filename: options.filename,
      label: options.label,
    },
  });
}
