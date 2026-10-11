/**
 * @file studentExportColumns.ts
 * @description Comprehensive export columns registry for Students covering all form tabs.
 */
import type { FieldDefinition, TabDefinition } from "./contactTypes.js";
import type { StudentsSettings } from "./studentsModuleSettings.js";

export interface StudentExportColumn {
  id: string;
  label: string;
}

/** Standard export columns covering all student form tabs. */
export const ALL_STUDENT_EXPORT_COLUMNS: readonly StudentExportColumn[] = [
  { id: "name", label: "Name" },
  { id: "grNumber", label: "GR Number" },
  { id: "studentId", label: "Student ID" },
  { id: "gender", label: "Gender" },
  { id: "dob", label: "Date of Birth" },
  { id: "solarDob", label: "Solar DOB" },
  { id: "lunarDob", label: "Lunar DOB" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "city", label: "City" },
  { id: "cnic", label: "CNIC" },
  { id: "parents", label: "Parents" },
  { id: "fatherName", label: "Father Name" },
  { id: "motherName", label: "Mother Name" },
  { id: "guardianName", label: "Guardian Name" },
  { id: "status", label: "Status" },
  { id: "registeredDate", label: "Registration Date" },
  { id: "enrollmentDate", label: "Enrollment Date" },
  { id: "enrolledSessions", label: "Enrolled Sessions" },
  { id: "discountType", label: "Discount Type" },
  { id: "discountPct", label: "Discount %" },
  { id: "registrationType", label: "Registration Type" },
  { id: "notes", label: "Notes" },
  { id: "createdAt", label: "Created At" },
  { id: "updatedAt", label: "Updated At" },
] as const;

/** Resolves all export columns including custom fields and dynamic tabs. */
export function resolveAllStudentExportColumns(
  settings?: StudentsSettings | null,
): StudentExportColumn[] {
  return mergeCustomStudentExportColumns([...ALL_STUDENT_EXPORT_COLUMNS], settings);
}

import { isStudentSeedFormTab } from "./moduleFieldSetupStudents.js";

/** Merges custom fields from tenant settings into the given columns. */
export function mergeCustomStudentExportColumns(
  columns: StudentExportColumn[],
  settings?: StudentsSettings | null,
): StudentExportColumn[] {
  const seen = new Set(columns.map((c) => c.id));
  const result = [...columns];

  if (settings?.fields && typeof settings.fields === "object") {
    for (const tabFields of Object.values(settings.fields)) {
      if (!Array.isArray(tabFields)) continue;
      for (const field of tabFields as FieldDefinition[]) {
        if (field?.key && !seen.has(field.key)) {
          seen.add(field.key);
          result.push({
            id: field.key,
            label: field.label || field.key,
          });
        }
      }
    }
  }

  if (Array.isArray(settings?.formTabs)) {
    for (const tab of settings.formTabs as TabDefinition[]) {
      if (tab?.key && !isStudentSeedFormTab(tab.key) && !seen.has(tab.key)) {
        seen.add(tab.key);
        result.push({
          id: tab.key,
          label: tab.label || tab.key,
        });
      }
    }
  }

  return result;
}
