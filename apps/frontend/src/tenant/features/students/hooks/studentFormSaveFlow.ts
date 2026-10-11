import { notify } from "@/lib/notify";
import type { Student, ValidationError, StudentDuplicateReason } from "@mms/shared";
import type { Contact } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { reportClientError } from "@/lib/clientErrorReporting";
import { scrollAndFocusFirstError } from "@/lib/forms/formAutoScroll";
import {
  validateStudentDraft,
  checkStudentFormDuplicate,
  prepareStudentForSave,
  DUPLICATE_ERROR_KEYS,
  type StudentValidationContext,
} from "./studentFormValidation";

interface StudentSaveFlowInput {
  studentDraft: Partial<Student>;
  student?: Partial<Student> | null;
  linkedContact?: Contact | null;
  linkedGenderRaw: string;
  validationContext: Omit<StudentValidationContext, "linkedGenderRaw" | "linkedDob">;
  blueprintVersion?: string | number | null;
  formInstanceId: string;
  t: TranslationFunction;
  onSave: (student: Student) => void | Promise<void>;
  onClose: () => void;
  keepOpen?: boolean;
  onBaselineReset?: (data: Partial<Student>) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  setSaving: (saving: boolean) => void;
  setPendingSaveData: (data: Partial<Student> | null) => void;
  setTypedDuplicateReason: (reason: StudentDuplicateReason | null) => void;
  setDuplicateConfirmOpen: (open: boolean) => void;
}

function focusStudentValidationField(formInstanceId: string, fieldId: string): void {
  const readOnlyFocusIds = new Set(["gender", "dob", "contactRelationships"]);
  const candidates = [
    `sf-${formInstanceId}-${fieldId}`,
    fieldId,
    fieldId === "gender" || fieldId === "dob" || fieldId === "contactId" ? "contactId" : "",
    readOnlyFocusIds.has(fieldId) ? `sf-${formInstanceId}-guardians` : "",
  ].filter(Boolean);

  scrollAndFocusFirstError(candidates, { behavior: "smooth", block: "center" });
}

function notifyStudentSaveFailed(t: TranslationFunction, err: unknown, scope: string): void {
  const validationMessage = getApiValidationMessage(err);
  notify.error(
    t("students.saveFailed"),
    validationMessage ? { description: validationMessage } : undefined,
  );
  reportClientError(err, { scope });
}

export async function runStudentSaveFlow(input: StudentSaveFlowInput): Promise<boolean> {
  input.setValidationErrors([]);

  const zodErrors = validateStudentDraft(input.studentDraft, {
    ...input.validationContext,
    linkedGenderRaw: input.linkedGenderRaw,
    linkedDob: input.linkedContact?.dob || "",
    linkedContact: input.linkedContact,
  });
  if (zodErrors) {
    input.setValidationErrors(zodErrors);
    const first = zodErrors[0];
    if (first) {
      focusStudentValidationField(input.formInstanceId, first.fieldId);
    }
    notify.error(input.t("common.formPleaseFixErrors"));
    return false;
  }

  input.setSaving(true);
  try {
    const duplicateReason = await checkStudentFormDuplicate({
      studentId: input.student?.id ? String(input.student.id) : undefined,
      contactId: String(input.studentDraft.contactId),
      linkedContact: input.linkedContact,
      grNumber:
        typeof input.studentDraft.grNumber === "string" ? input.studentDraft.grNumber : undefined,
    });

    if (duplicateReason === "grNumber") {
      input.setValidationErrors([
        {
          fieldId: "grNumber",
          tabId: "registration",
          message: input.t(DUPLICATE_ERROR_KEYS.grNumber),
        },
      ]);
      focusStudentValidationField(input.formInstanceId, "grNumber");
      notify.error(input.t(DUPLICATE_ERROR_KEYS.grNumber));
      input.setSaving(false);
      return false;
    }

    if (duplicateReason) {
      input.setPendingSaveData(input.studentDraft);
      input.setTypedDuplicateReason(duplicateReason);
      input.setDuplicateConfirmOpen(true);
      input.setSaving(false);
      return false;
    }

    await commitStudentSave({
      data: input.studentDraft,
      student: input.student,
      blueprintVersion: input.blueprintVersion,
      onSave: input.onSave,
    });
    input.onBaselineReset?.(input.studentDraft);
    if (!input.keepOpen) {
      input.onClose();
    }
    return true;
  } catch (err: unknown) {
    const validationMessage = getApiValidationMessage(err);
    const errText = String(err instanceof Error ? err.message : err || "").toLowerCase();
    const isGrConflict =
      errText.includes("gr") ||
      errText.includes("grnumber") ||
      errText.includes("duplicate_gr") ||
      (typeof validationMessage === "string" && validationMessage.toLowerCase().includes("gr"));

    if (isGrConflict) {
      input.setValidationErrors([
        {
          fieldId: "grNumber",
          tabId: "registration",
          message: input.t(DUPLICATE_ERROR_KEYS.grNumber),
        },
      ]);
      focusStudentValidationField(input.formInstanceId, "grNumber");
      notify.error(input.t(DUPLICATE_ERROR_KEYS.grNumber));
      return false;
    }

    notifyStudentSaveFailed(input.t, err, "students.form_save");
    return false;
  } finally {
    input.setSaving(false);
  }
}

export async function confirmPendingStudentSave(input: {
  pendingSaveData: Partial<Student> | null;
  student?: Partial<Student> | null;
  blueprintVersion?: string | number | null;
  t: TranslationFunction;
  onSave: (student: Student) => void | Promise<void>;
  onClose: () => void;
  setSaving: (saving: boolean) => void;
  setPendingSaveData: (data: Partial<Student> | null) => void;
  setDuplicateConfirmOpen: (open: boolean) => void;
}): Promise<void> {
  if (!input.pendingSaveData) return;
  input.setSaving(true);
  try {
    await commitStudentSave({
      data: input.pendingSaveData,
      student: input.student,
      blueprintVersion: input.blueprintVersion,
      onSave: input.onSave,
    });
    input.setPendingSaveData(null);
    input.setDuplicateConfirmOpen(false);
    input.onClose();
  } catch (err: unknown) {
    notifyStudentSaveFailed(input.t, err, "students.form_save_confirm");
  } finally {
    input.setSaving(false);
  }
}

async function commitStudentSave(input: {
  data: Partial<Student>;
  student?: Partial<Student> | null;
  blueprintVersion?: string | number | null;
  onSave: (student: Student) => void | Promise<void>;
}): Promise<void> {
  await input.onSave(
    prepareStudentForSave({
      data: input.data,
      studentId: input.student?.id,
      enrolledSessions: input.student?.enrolledSessions,
      blueprintVersion: input.blueprintVersion,
    }),
  );
}
