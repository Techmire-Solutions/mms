import { type z } from "zod";
import type { FieldDefinition } from "../contacts/contactTypes.js";
import type { ValidationError } from "../contacts/contactValidation.js";

export {
  FACULTY_WRITE_SYSTEM_KEYS,
  collectFacultyWriteExtraFieldKeys,
  buildDynamicFacultySchema,
} from "../schemas/faculty.dto.js";

const SYSTEM_FIELD_TABS: Record<string, string> = {
  employeeId: "employment",
  status: "employment",
  employmentStartDate: "employment",
  employmentEndDate: "employment",
  joinDate: "employment",
  employmentContractType: "employment",
  leaveDetails: "employment",
  designationId: "designation",
  designationStartDate: "designation",
  designationEndDate: "designation",
  employDesignationStatus: "designation",
  profileStatus: "designation",
  specialization: "basic",
  qualification: "basic",
  notes: "basic",
  ijazahs: "basic",
};

/**
 * Translates Zod validation errors into structured field errors for the Faculty form.
 */
export function formatFacultyZodIssues(
  error: z.ZodError,
  _data: unknown,
  fields: Record<string, FieldDefinition[]>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const issue of error.issues) {
    const fieldId = String(issue.path[0] ?? "");
    let tabId = SYSTEM_FIELD_TABS[fieldId] ?? "basic";
    for (const [candidateTabId, tabFields] of Object.entries(fields)) {
      if (tabFields.some((field) => field.key === fieldId)) {
        tabId = candidateTabId;
        break;
      }
    }
    errors.push({ fieldId, tabId, message: issue.message });
  }
  return errors;
}
