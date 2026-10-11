import {
  sanitizeStudentForViewer as sanitizeStudentRecord,
  sanitizeStudentsForViewer as sanitizeStudentRecords,
  type Student,
  type StudentsSettings,
} from "@mms/shared";
import { loadStudentFieldConfig } from "./studentConfigService.js";

function settingsSnapshot(settings: StudentsSettings | null) {
  if (!settings) return null;
  const fields =
    settings.fields && typeof settings.fields === "object" && !Array.isArray(settings.fields)
      ? (settings.fields as Record<string, import("@mms/shared").FieldDefinition[]>)
      : undefined;
  if (!fields) return null;
  return {
    fields,
    tabs: settings.formTabs ?? [],
  };
}

/** Strips student properties the viewer role cannot read (field-config + viewer role). */
export async function sanitizeStudentForViewer(
  student: Student,
  viewerRole: string,
): Promise<Student> {
  const config = settingsSnapshot(await loadStudentFieldConfig());
  if (!config) return student;
  return sanitizeStudentRecord(student, viewerRole, config);
}

export async function sanitizeStudentsForViewer(
  students: Student[],
  viewerRole: string,
): Promise<Student[]> {
  const config = settingsSnapshot(await loadStudentFieldConfig());
  if (!config) return students;
  return sanitizeStudentRecords(students, viewerRole, config);
}
