/**
 * @file facultyExportColumns.ts
 * @description Comprehensive export columns registry for Faculty covering all form tabs.
 */
import type { FieldDefinition, TabDefinition } from "../contacts/contactTypes.js";
import type { FacultySettings } from "./facultyModuleSettings.js";
import { isFacultySeedFormTab } from "../settings/moduleFieldSetupFaculty.js";

export interface FacultyExportColumn {
  id: string;
  label: string;
}

/** Standard export columns covering all faculty form tabs. */
export const ALL_FACULTY_EXPORT_COLUMNS: readonly FacultyExportColumn[] = [
  { id: "name", label: "Name" },
  { id: "employeeId", label: "Employee ID" },
  { id: "contactId", label: "Contact ID" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "gender", label: "Gender" },
  { id: "dob", label: "Date of Birth" },
  { id: "cnic", label: "CNIC" },
  { id: "department", label: "Department" },
  { id: "designation", label: "Designation" },
  { id: "reportingFacultyName", label: "Supervisor" },
  { id: "employDesignationStatus", label: "Designation Status" },
  { id: "profileStatus", label: "Profile Status" },
  { id: "designationStartDate", label: "Designation Start Date" },
  { id: "designationEndDate", label: "Designation End Date" },
  { id: "status", label: "Employment Status" },
  { id: "joinDate", label: "Join Date" },
  { id: "employmentStartDate", label: "Employment Start Date" },
  { id: "employmentEndDate", label: "Employment End Date" },
  { id: "specialization", label: "Specialization" },
  { id: "qualification", label: "Qualification" },
  { id: "performanceRating", label: "Performance Rating" },
  { id: "userId", label: "User Account ID" },
  { id: "userEmail", label: "User Account Email" },
  { id: "userRole", label: "User Account Role" },
  { id: "notes", label: "Notes" },
  { id: "createdAt", label: "Created At" },
  { id: "updatedAt", label: "Updated At" },
] as const;

/** Resolves all export columns including custom fields and dynamic tabs. */
export function resolveAllFacultyExportColumns(
  settings?: FacultySettings | null,
): FacultyExportColumn[] {
  return mergeCustomFacultyExportColumns([...ALL_FACULTY_EXPORT_COLUMNS], settings);
}

/** Merges custom fields from tenant settings into the given columns. */
export function mergeCustomFacultyExportColumns(
  columns: FacultyExportColumn[],
  settings?: FacultySettings | null,
): FacultyExportColumn[] {
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
      if (tab?.key && !isFacultySeedFormTab(tab.key) && !seen.has(tab.key)) {
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
