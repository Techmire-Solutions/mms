import {
  type Student,
  type Contact,
  normalizeStoredStudent,
  getPrimaryEmail,
  listStudentContactRelationships,
  resolveStudentContactProfileGaps,
  resolveStudentContactProfileRequirements,
  resolveStudentGuardianLinks,
  translateApp,
  type StudentDuplicateReason,
  type AppTranslationKey,
  buildDynamicStudentSchema,
  buildStudentWriteSchema,
  collectStudentWriteExtraFieldKeys,
  formatStudentZodIssues,
  type ValidationError,
  type FieldDefinition,
  type StudentsSettings,
} from "@mms/shared";
import { checkStudentRegistrationDuplicate } from "@/tenant/features/students/hooks/useStudents";

export const DUPLICATE_ERROR_KEYS: Record<StudentDuplicateReason, AppTranslationKey> = {
  contact: "students.form.contactAlreadyStudent",
  email: "students.form.duplicateEmail",
  nameDob: "students.form.duplicateNameDob",
  grNumber: "students.form.duplicateGrNumber",
};

export interface StudentValidationContext {
  settings: StudentsSettings;
  enabledTabs: Set<string>;
  requiredTabs: Set<string>;
  fields: Record<string, FieldDefinition[]>;
  language: string;
  linkedGenderRaw: string;
  linkedDob: string;
  linkedContact?: Contact | null;
  /** Localizes wire-DTO (base schema) messages; blueprint messages are already localized. */
  resolveMessage?: (message: string) => string;
}

export function validateStudentDraft(
  studentDraft: Partial<Student>,
  context: StudentValidationContext,
): ValidationError[] | null {
  const schema = buildDynamicStudentSchema(
    context.settings,
    context.enabledTabs,
    context.requiredTabs,
    context.fields,
    context.language,
  );

  const guardians = resolveStudentGuardianLinks(studentDraft, context.linkedContact ?? null);
  const validationDraft = {
    ...studentDraft,
    ...guardians,
    gender: context.linkedGenderRaw,
    dob: context.linkedDob,
  };

  const errors: ValidationError[] = [];

  // Layer 1 — the tenant-aware wire DTO the API validates first (strict
  // allowlist, column-width bounds, numeric/string types). This mirrors
  // `validateStudentWrite` before the dynamic blueprint is applied.
  const baseSchema = buildStudentWriteSchema(collectStudentWriteExtraFieldKeys(context.settings));
  const baseResult = baseSchema.safeParse(validationDraft);
  if (!baseResult.success) {
    const resolve = context.resolveMessage ?? ((message: string) => message);
    errors.push(
      ...formatStudentZodIssues(baseResult.error, validationDraft, context.fields).map((issue) => ({
        ...issue,
        message: resolve(issue.message),
      })),
    );
  }

  // Layer 2 — the tenant Setup blueprint (required tabs/fields and field types).
  const parseResult = schema.safeParse(validationDraft);
  if (!parseResult.success) {
    const seen = new Set(
      errors.map(
        (issue) => `${issue.tabId}|${issue.fieldId}|${issue.index ?? ""}|${issue.message}`,
      ),
    );
    for (const issue of formatStudentZodIssues(
      parseResult.error,
      validationDraft,
      context.fields,
    )) {
      const key = `${issue.tabId}|${issue.fieldId}|${issue.index ?? ""}|${issue.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push(issue);
      }
    }
  }

  // Layer 3 — contact-profile checks. Relationships, address and education live on
  // the linked contact, so Setup's required toggles are enforced from the contact.
  // Only run once a contact is linked: the blueprint already reports the missing
  // contact, and reporting the profile gaps too would be noisy/redundant.
  if (validationDraft.contactId != null && String(validationDraft.contactId).trim()) {
    const profileRequirements = resolveStudentContactProfileRequirements(context.fields);
    const profileGaps = resolveStudentContactProfileGaps(
      context.linkedContact ?? null,
      profileRequirements,
      guardians,
    );
    const message = (key: AppTranslationKey) => translateApp(key, context.language);
    if (profileGaps.relationships) {
      errors.push({
        fieldId: "contactRelationships",
        tabId: "basic",
        message: message("students.form.relationshipsRequired"),
      });
    }
    if (profileGaps.address) {
      errors.push({
        fieldId: "address",
        tabId: "basic",
        message: message("students.form.addressRequired"),
      });
    }
    if (profileGaps.education) {
      errors.push({
        fieldId: "education",
        tabId: "basic",
        message: message("students.form.educationRequired"),
      });
    }
  }

  return errors.length > 0 ? errors : null;
}

interface StudentDuplicateCheckInput {
  studentId?: string;
  contactId: string;
  linkedContact?: Contact | null;
  grNumber?: string;
}

export async function checkStudentFormDuplicate(
  input: StudentDuplicateCheckInput,
): Promise<StudentDuplicateReason | null> {
  const email = (input.linkedContact ? getPrimaryEmail(input.linkedContact) : null) || "";
  return checkStudentRegistrationDuplicate({
    excludeId: input.studentId ? String(input.studentId) : undefined,
    contactId: String(input.contactId),
    email,
    name: input.linkedContact?.name,
    dob: input.linkedContact?.dob || undefined,
    grNumber: input.grNumber,
  });
}

interface PrepareStudentSaveInput {
  data: Partial<Student>;
  studentId?: string | number;
  enrolledSessions?: Student["enrolledSessions"];
  blueprintVersion?: string | number | null;
}

export function prepareStudentForSave(input: PrepareStudentSaveInput): Student {
  return normalizeStoredStudent({
    ...input.data,
    registeredDate: input.data.registeredDate || undefined,
    ...(input.studentId != null ? { id: input.studentId } : {}),
    enrolledSessions: input.enrolledSessions || [],
    ...(input.blueprintVersion != null ? { _blueprintId: String(input.blueprintVersion) } : {}),
  }) as Student;
}

/** Exclude the student's relationship links (from Contacts) from the student-contact picker. */
export function buildStudentContactExcludeIds(
  linkedStudentContactIds: Array<string | number>,
  linkedContact?: Contact | null,
): string[] {
  const relatedIds = listStudentContactRelationships(linkedContact ?? null)
    .map((link) => link.contactId)
    .filter(Boolean)
    .map(String);
  return [...relatedIds, ...linkedStudentContactIds.map(String)];
}
