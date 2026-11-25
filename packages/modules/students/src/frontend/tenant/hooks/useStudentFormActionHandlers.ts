import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";
import { useCallback, useRef } from "react";
import type {
  Contact,
  FieldDefinition,
  Student,
  StudentDuplicateReason,
  StudentsSettings,
  ValidationError,
} from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { getApiValidationMessage } from "@mms/fe-core/api/validationMessage";
import { reportClientError } from "@mms/fe-core/reporting/clientErrorReporting";
import { DUPLICATE_ERROR_KEYS } from "./studentFormValidation";
import { buildContactSelectPatch, resolveStudentGrForSave } from "./studentFormHandlers";
import { confirmPendingStudentSave, runStudentSaveFlow } from "./studentFormSaveFlow";

interface UseStudentFormActionHandlersOptions {
  student?: Partial<Student> | null;
  studentDraft: Partial<Student>;
  linkedContact: Contact | null | undefined;
  nextGrNumber: string | undefined;
  autoGenerateId: boolean;
  settings: StudentsSettings;
  enabledTabs: Set<string>;
  language: string;
  t: TranslationFunction;
  onSave: (student: Student) => void | Promise<void>;
  onClose: () => void;
  updateDraft: (patch: Partial<Student>) => void;
  updateContact: { mutateAsync: (args: { id: string; contact: Contact }) => Promise<unknown> };
  pendingSaveData: Partial<Student> | null;
  typedDuplicateReason: StudentDuplicateReason | null;
  validationErrors: ValidationError[];
  setValidationErrors: (errors: ValidationError[]) => void;
  setSaving: (value: boolean) => void;
  /** Non-field failure banner state owned by the form controller. */
  setFormError: (message: string | null) => void;
  setPendingSaveData: (value: Partial<Student> | null) => void;
  setTypedDuplicateReason: (value: StudentDuplicateReason | null) => void;
  setDuplicateConfirmOpen: (value: boolean) => void;
  formInstanceId: string;
  onBaselineReset?: (data: Partial<Student>) => void;
  contactDobOverride?: string | null;
  setContactDobOverride?: (dob: string | null) => void;
}

export function useStudentFormActionHandlers({
  student,
  studentDraft,
  linkedContact,
  nextGrNumber,
  autoGenerateId,
  settings,
  enabledTabs,
  language,
  t,
  onSave,
  onClose,
  updateDraft,
  updateContact,
  pendingSaveData,
  typedDuplicateReason,
  validationErrors,
  setValidationErrors,
  setSaving,
  setFormError,
  setPendingSaveData,
  setTypedDuplicateReason,
  setDuplicateConfirmOpen,
  formInstanceId,
  onBaselineReset,
  contactDobOverride,
  setContactDobOverride,
}: UseStudentFormActionHandlersOptions) {
  const clearDuplicatePrompt = useCallback(() => {
    setDuplicateConfirmOpen(false);
    setTypedDuplicateReason(null);
    setPendingSaveData(null);
  }, [setDuplicateConfirmOpen, setPendingSaveData, setTypedDuplicateReason]);

  const handleDuplicateDialogOpenChange = (open: boolean) => {
    if (!open) clearDuplicatePrompt();
    else setDuplicateConfirmOpen(true);
  };

  const savingRef = useRef(false);

  const handleSave = async (options?: { keepOpen?: boolean }): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    try {
      const draftForSave = resolveStudentGrForSave(
        student,
        studentDraft,
        nextGrNumber,
        autoGenerateId,
      );
      return await runStudentSaveFlow({
        studentDraft: draftForSave,
        student,
        linkedContact,
        linkedGenderRaw: linkedContact?.gender?.trim() || "",
        effectiveDob: contactDobOverride ?? (linkedContact?.dob || ""),
        updateContact,
        validationContext: {
          settings,
          enabledTabs,
          requiredTabs: new Set(settings.requiredTabs || []),
          fields: (settings.fields ?? {}) as Record<string, FieldDefinition[]>,
          language,
          resolveMessage: (message) => translateValidationMessage(message, t),
        },
        blueprintVersion: settings.version,
        formInstanceId,
        t,
        onSave,
        onClose,
        keepOpen: options?.keepOpen,
        onBaselineReset,
        setValidationErrors,
        setSaving: (value: boolean) => {
          savingRef.current = value;
          setSaving(value);
        },
        setFormError,
        setPendingSaveData,
        setTypedDuplicateReason,
        setDuplicateConfirmOpen,
      });
    } finally {
      // The flow clears saving on every exit path; this also releases the guard
      // when a save is aborted before the flow's own finally runs.
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmDuplicateSave = () => {
    const pending = pendingSaveData
      ? resolveStudentGrForSave(student, pendingSaveData, nextGrNumber, autoGenerateId)
      : null;
    void confirmPendingStudentSave({
      pendingSaveData: pending,
      student,
      blueprintVersion: settings.version,
      t,
      onSave,
      onClose,
      setSaving,
      setPendingSaveData,
      setDuplicateConfirmOpen,
    });
  };

  const handleContactSelect = (id: string | number | null): void => {
    setContactDobOverride?.(null);
    const patch = buildContactSelectPatch(id, student, studentDraft, nextGrNumber, autoGenerateId);
    if (patch) updateDraft(patch);
  };

  const handleStudentAvatarChange = async (avatarUrl: string): Promise<void> => {
    if (!studentDraft.contactId || !linkedContact) return;
    try {
      await updateContact.mutateAsync({
        id: String(studentDraft.contactId),
        contact: { ...linkedContact, avatar: avatarUrl },
      });
    } catch (err) {
      const validationMessage = getApiValidationMessage(err);
      notify.error(
        t("students.saveFailed"),
        validationMessage ? { description: validationMessage } : undefined,
      );
      reportClientError(err, { scope: "students.avatar_update" });
    }
  };

  const handleStudentDobChange = async (dob: string): Promise<void> => {
    setContactDobOverride?.(dob);
    if (!studentDraft.contactId || !linkedContact) return;
    try {
      await updateContact.mutateAsync({
        id: String(studentDraft.contactId),
        contact: { ...linkedContact, dob },
      });
      setValidationErrors(validationErrors.filter((err) => err.fieldId !== "dob"));
    } catch (err) {
      const validationMessage = getApiValidationMessage(err);
      notify.error(
        t("students.saveFailed"),
        validationMessage ? { description: validationMessage } : undefined,
      );
      reportClientError(err, { scope: "students.dob_update" });
    }
  };

  const errorSummary = (() => {
    if (typedDuplicateReason) return t(DUPLICATE_ERROR_KEYS[typedDuplicateReason]);
    return "";
  })();

  const validationErrorSummary = (() => {
    if (validationErrors.length === 0) return undefined;
    return validationErrors.map((validationError) => validationError.message);
  })();

  return {
    handleDuplicateDialogOpenChange,
    handleSave,
    confirmDuplicateSave,
    handleContactSelect,
    handleStudentAvatarChange,
    handleStudentDobChange,
    errorSummary,
    validationErrorSummary,
    duplicateErrorKeys: DUPLICATE_ERROR_KEYS,
  };
}
