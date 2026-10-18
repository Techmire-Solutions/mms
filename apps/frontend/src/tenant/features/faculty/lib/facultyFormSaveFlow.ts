import { notify } from "@/lib/notify";
import {
  type FacultySettings,
  type FacultyMember,
  type FacultyDuplicateReason,
  type Contact,
  type ValidationError,
  type FieldDefinition,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  checkFacultyFormDuplicate,
  DUPLICATE_ERROR_KEYS,
  focusFacultyValidationField,
  facultyValidationErrorsByField,
  validateFacultyDraft,
} from "@/tenant/features/faculty/lib/facultyFormValidation";
import type { FacultyUserAccountDraft } from "@/tenant/features/faculty/components/FacultyUserAccountSection";
import {
  confirmPendingFacultySave,
  notifyFacultySaveFailed,
  syncUserAccount,
} from "@/tenant/features/faculty/lib/facultyFormUserSync";
import {
  buildFacultySavePayload,
  validateUserDraftRequirements,
  isEmployeeIdConflictError,
} from "@/tenant/features/faculty/lib/facultyFormSavePayload";

export { focusFacultyValidationField, confirmPendingFacultySave };

export interface FacultySaveFlowInput {
  facultyDraft: Partial<FacultyMember>;
  faculty?: FacultyMember;
  autoGenerateId: boolean;
  nextEmployeeId?: string;
  formInstanceId: string;
  linkedContact?: Contact | null;
  settings: FacultySettings;
  enabledTabs: Set<string>;
  fields: Record<string, FieldDefinition[]>;
  language: string;
  t: TranslationFunction;
  onSave: (faculty: FacultyMember) => void | Promise<void>;
  onClose: () => void;
  keepOpen?: boolean;
  onBaselineReset?: (payload: Partial<FacultyMember>) => void;
  setErrors: (errors: Record<string, string>) => void;
  setSaving: (saving: boolean) => void;
  setPendingSaveData: (data: Partial<FacultyMember> | null) => void;
  setTypedDuplicateReason: (reason: FacultyDuplicateReason | null) => void;
  setDuplicateConfirmOpen: (open: boolean) => void;
  userAccountDraft?: FacultyUserAccountDraft;
  linkedUser?: { id: string; role?: string } | null;
  onUserInvalidate?: () => void;
}

/** Validate + persist faculty form draft; surfaces field errors and toasts on failure. */
export async function runFacultySaveFlow(input: FacultySaveFlowInput): Promise<boolean> {
  input.setErrors({});
  const payload = buildFacultySavePayload(input);

  const validationErrors: ValidationError[] | null = validateFacultyDraft(
    payload as Record<string, unknown>,
    {
      settings: input.settings,
      enabledTabs: input.enabledTabs,
      fields: input.fields,
      language: input.language,
    },
  );
  if (validationErrors) {
    input.setErrors(facultyValidationErrorsByField(validationErrors));
    const firstField = validationErrors[0]?.fieldId;
    if (firstField) focusFacultyValidationField(input.formInstanceId, firstField);
    notify.error(input.t("common.formPleaseFixErrors"));
    return false;
  }

  const allowedDesignationRoles = input.facultyDraft.designationAssignableRoles;
  if (
    input.userAccountDraft?.enabled &&
    input.facultyDraft.designationId &&
    !(allowedDesignationRoles ?? []).includes(input.userAccountDraft.role)
  ) {
    input.setErrors({ "user.role": input.t("faculty.designations.roleNotAllowed") });
    notify.error(input.t("faculty.designations.roleNotAllowed"));
    return false;
  }

  if (!validateUserDraftRequirements(input)) return false;

  input.setSaving(true);
  try {
    const duplicateReason = await checkFacultyFormDuplicate({
      facultyId: input.faculty?.id ? String(input.faculty.id) : undefined,
      contactId: String(input.facultyDraft.contactId || ""),
      linkedContact: input.linkedContact,
      employeeId: typeof payload.employeeId === "string" ? payload.employeeId : undefined,
    });

    if (duplicateReason === "employeeId") {
      input.setErrors({ employeeId: input.t(DUPLICATE_ERROR_KEYS.employeeId) });
      focusFacultyValidationField(input.formInstanceId, "employeeId");
      notify.error(input.t(DUPLICATE_ERROR_KEYS.employeeId));
      return false;
    }

    if (duplicateReason) {
      input.setPendingSaveData(payload);
      input.setTypedDuplicateReason(duplicateReason);
      input.setDuplicateConfirmOpen(true);
      return false;
    }

    const userOk = await syncUserAccount({
      userAccountDraft: input.userAccountDraft,
      linkedUser: input.linkedUser,
      contactId: payload.contactId,
      payload: payload as Record<string, unknown>,
      t: input.t,
      setErrors: input.setErrors,
      onUserInvalidate: input.onUserInvalidate,
    });
    if (!userOk) return false;

    await input.onSave(payload as FacultyMember);
    input.onBaselineReset?.(payload);
    if (!input.keepOpen) input.onClose();
    return true;
  } catch (err: unknown) {
    if (isEmployeeIdConflictError(err)) {
      input.setErrors({ employeeId: input.t(DUPLICATE_ERROR_KEYS.employeeId) });
      focusFacultyValidationField(input.formInstanceId, "employeeId");
      notify.error(input.t(DUPLICATE_ERROR_KEYS.employeeId));
      return false;
    }

    notifyFacultySaveFailed(input.t, err, "faculty.form_save");
    return false;
  } finally {
    input.setSaving(false);
  }
}
