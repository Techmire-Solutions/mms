import { useCallback, useMemo, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { invalidateUsersQueries } from "@/tenant/hooks/collections/users";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import type {
  AppTranslationKey,
  Contact,
  FacultyDuplicateReason,
  FacultyMember,
  FacultySettings,
  FieldDefinition,
} from "@mms/shared";
import { facultyDraftSnapshot } from "@/tenant/features/faculty/lib/facultyFormDraft";
import {
  confirmPendingFacultySave,
  runFacultySaveFlow,
} from "@/tenant/features/faculty/lib/facultyFormSaveFlow";
import { DUPLICATE_ERROR_KEYS } from "@/tenant/features/faculty/lib/facultyFormValidation";
import type {
  FacultyUserAccountDraft,
  LinkedUserInfo,
} from "@/tenant/features/faculty/components/FacultyUserAccountSection";

export interface UseFacultyFormSaveActionsInput {
  facultyDraft?: Partial<FacultyMember>;
  faculty?: FacultyMember;
  autoGenerateId: boolean;
  nextEmployeeId?: string;
  formInstanceId: string;
  linkedContact?: Contact | null;
  settings: FacultySettings;
  enabledTabs: Set<string>;
  fieldsMap: Record<string, FieldDefinition[]>;
  language: string;
  t: TranslationFunction;
  onSave: (faculty: FacultyMember) => void | Promise<void>;
  onClose: () => void;
  setBaselineSnapshot: (snapshot: string) => void;
  userAccountDraft: FacultyUserAccountDraft;
  linkedUser?: LinkedUserInfo | null;
  queryClient: QueryClient;
}

export function useFacultyFormSaveActions({
  facultyDraft,
  faculty,
  autoGenerateId,
  nextEmployeeId,
  formInstanceId,
  linkedContact,
  settings,
  enabledTabs,
  fieldsMap,
  language,
  t,
  onSave,
  onClose,
  setBaselineSnapshot,
  userAccountDraft,
  linkedUser,
  queryClient,
}: UseFacultyFormSaveActionsInput) {
  const currentDraft = facultyDraft ?? {};
  const currentFaculty = faculty;
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingSaveData, setPendingSaveData] = useState<Partial<FacultyMember> | null>(null);
  const [typedDuplicateReason, setTypedDuplicateReason] = useState<FacultyDuplicateReason | null>(
    null,
  );
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  // Confirm runs from a dialog button: a same-frame double click must not save twice.
  const submitGuard = useSubmitGuard();

  const clearDuplicatePrompt = () => {
    setDuplicateConfirmOpen(false);
    setTypedDuplicateReason(null);
    setPendingSaveData(null);
  };

  const clearEmployeeIdError = useCallback(() => {
    setErrors((prev) => {
      if (!prev.employeeId) return prev;
      const { employeeId: _omitted, ...rest } = prev;
      return rest;
    });
    setServerError((prev) => (prev?.toLowerCase().includes("employee") ? null : prev));
  }, []);

  const handleDuplicateDialogOpenChange = (open: boolean) =>
    open ? setDuplicateConfirmOpen(true) : clearDuplicatePrompt();

  const validationErrorSummary = useMemo(() => {
    const messages = Object.values(errors).filter(Boolean);
    const reasonMessage = typedDuplicateReason ? t(DUPLICATE_ERROR_KEYS[typedDuplicateReason]) : "";
    if (reasonMessage) messages.push(reasonMessage);
    if (serverError) messages.push(serverError);
    return messages.length > 0 ? [...new Set(messages)] : undefined;
  }, [errors, serverError, typedDuplicateReason, t]);

  const handleSave = async (options?: { keepOpen?: boolean }): Promise<boolean> => {
    return await runFacultySaveFlow({
      facultyDraft: currentDraft,
      faculty: currentFaculty,
      autoGenerateId,
      nextEmployeeId,
      formInstanceId,
      linkedContact,
      settings,
      enabledTabs,
      fields: fieldsMap,
      language,
      t,
      onSave,
      onClose,
      keepOpen: options?.keepOpen,
      onBaselineReset: (payload) => setBaselineSnapshot(facultyDraftSnapshot(payload)),
      setErrors,
      setServerError,
      setSaving,
      setPendingSaveData,
      setTypedDuplicateReason,
      setDuplicateConfirmOpen,
      userAccountDraft,
      linkedUser,
      onUserInvalidate: () => invalidateUsersQueries(queryClient),
    });
  };

  const confirmDuplicateSave = async (): Promise<boolean> => {
    const result = await submitGuard(async () =>
      confirmPendingFacultySave({
        pendingSaveData,
        faculty: currentFaculty,
        t,
        onSave,
        onClose,
        setSaving,
        setPendingSaveData,
        setDuplicateConfirmOpen,
        userAccountDraft,
        linkedUser,
        onUserInvalidate: () => invalidateUsersQueries(queryClient),
        setErrors,
        onError: (error) => {
          // Keep `pendingSaveData` and the confirm dialog open so the user can retry
          // after fixing whatever the server rejected.
          const mapped = mapApiFormError(error, (message) => t(message as AppTranslationKey));
          setErrors(
            mapped.fieldErrors ?? { save: mapped.message ?? t("faculty.toast.saveFailed") },
          );
        },
      }),
    );
    return result ?? false;
  };

  return {
    saving,
    errors,
    setErrors,
    serverError,
    handleSave,
    confirmDuplicateSave,
    validationErrorSummary,
    pendingSaveData,
    typedDuplicateReason,
    duplicateConfirmOpen,
    clearDuplicatePrompt,
    clearEmployeeIdError,
    handleDuplicateDialogOpenChange,
  };
}
