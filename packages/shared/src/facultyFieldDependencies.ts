import type { ColumnRegistryEntry } from "./contactTypes.js";
import { FACULTY_COLUMN_FIELD_MAPPING } from "./facultyDirectoryColumns.js";
import { createFieldRemovalIssuesChecker } from "./createFieldRemovalIssuesChecker.js";
import { listFacultySystemFormFieldKeys } from "./facultyFormCustomFields.js";

export type FacultyFieldDependencyArea = "systemField" | "column";

export interface FacultyFieldDependencyIssue {
  area: FacultyFieldDependencyArea;
  /** i18n key — FE passes to t() with optional { count }. */
  messageKey: string;
  count?: number;
}

export interface FacultyFieldDependencyInput {
  fieldKey: string;
  columnRegistry: ColumnRegistryEntry[];
}

const checker = createFieldRemovalIssuesChecker({
  systemFieldKeys: listFacultySystemFormFieldKeys(),
  columnFieldMapping: FACULTY_COLUMN_FIELD_MAPPING,
  messageKeys: {
    systemField: "faculty.setup.cannotDeleteSystemField",
    fieldUsedInColumn: "faculty.setup.fieldUsedInColumn",
  },
});

export const isFacultySeedFieldKey = checker.isSeedFieldKey;

/**
 * Returns blocking issues before removing a field from Faculty Setup.
 * Checks system seed keys and enabled Work column registry usage.
 */
export function getFacultyFieldRemovalIssues(
  input: FacultyFieldDependencyInput,
): FacultyFieldDependencyIssue[] {
  return checker.getFieldRemovalIssues(input);
}
