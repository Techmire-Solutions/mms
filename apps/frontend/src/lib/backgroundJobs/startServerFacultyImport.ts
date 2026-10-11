import type {
  BackgroundJobRecord,
  FacultyCsvImportRow,
  FacultyDepartmentCsvRow,
  FacultyDesignationCsvRow,
} from "@mms/shared";
import { startServerBackgroundJob } from "@/lib/backgroundJobs/startServerBackgroundJob";

export async function startServerFacultyMembersImport(options: {
  rows: FacultyCsvImportRow[];
  label: string;
  onProgress?: (job: BackgroundJobRecord) => void;
}): Promise<BackgroundJobRecord> {
  return startServerBackgroundJob({
    path: "/api/faculty/import",
    body: { rows: options.rows, label: options.label },
    onProgress: options.onProgress,
  });
}

export async function startServerFacultyDepartmentsImport(options: {
  rows: FacultyDepartmentCsvRow[];
  label: string;
  onProgress?: (job: BackgroundJobRecord) => void;
}): Promise<BackgroundJobRecord> {
  return startServerBackgroundJob({
    path: "/api/faculty/departments/import",
    body: { rows: options.rows, label: options.label },
    onProgress: options.onProgress,
  });
}

export async function startServerFacultyDesignationsImport(options: {
  rows: FacultyDesignationCsvRow[];
  label: string;
  onProgress?: (job: BackgroundJobRecord) => void;
}): Promise<BackgroundJobRecord> {
  return startServerBackgroundJob({
    path: "/api/faculty/designations/import",
    body: {
      rows: options.rows.map((r) => ({
        department: r.department,
        name: r.name,
        parentDesignation: r.parentDesignation,
        status: r.status,
      })),
      label: options.label,
    },
    onProgress: options.onProgress,
  });
}
