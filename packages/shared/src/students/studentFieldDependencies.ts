import {
  INITIAL_STUDENT_FIELD_SEED,
  STUDENT_COLUMN_FIELD_MAPPING,
} from "../settings/moduleFieldSetupPersons.js";
import type { ColumnRegistryEntry } from "../contacts/contactTypes.js";
import { createFieldRemovalIssuesChecker } from "../core/createFieldRemovalIssuesChecker.js";

export type StudentFieldDependencyArea = "systemField" | "column";

export interface StudentFieldDependencyIssue {
  area: StudentFieldDependencyArea;
  /** i18n key — FE passes to t() with optional { count }. */
  messageKey: string;
  count?: number;
}

const SEED_FIELD_KEYS = new Set(
  Object.values(INITIAL_STUDENT_FIELD_SEED).flatMap((fields) => fields.map((field) => field.key)),
);

const checker = createFieldRemovalIssuesChecker({
  systemFieldKeys: SEED_FIELD_KEYS,
  columnFieldMapping: STUDENT_COLUMN_FIELD_MAPPING,
  messageKeys: {
    systemField: "students.setup.cannotDeleteSystemField",
    fieldUsedInColumn: "students.setup.fieldUsedInColumn",
  },
});

export const isStudentSeedFieldKey = checker.isSeedFieldKey;

export interface StudentFieldDependencyInput {
  fieldKey: string;
  columnRegistry: ColumnRegistryEntry[];
}

/**
 * Returns blocking issues before removing a field from Students Setup.
 * Checks system seed keys and enabled Work column registry usage.
 */
export function getStudentFieldRemovalIssues(
  input: StudentFieldDependencyInput,
): StudentFieldDependencyIssue[] {
  return checker.getFieldRemovalIssues(input);
}
