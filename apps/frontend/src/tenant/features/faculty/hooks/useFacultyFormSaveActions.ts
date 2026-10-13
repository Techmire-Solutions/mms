import { useMemo, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { invalidateUsersQueries } from "@/tenant/hooks/collections/users";
import type {
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
  const [pendingSaveData, setPendingSaveData] = useState<Partial<FacultyMember> | null>(null);
  const [typedDuplicateReason, setTypedDuplicateReason] = useState<FacultyDuplicateReason | null>(
    null,
  );
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);

  const clearDuplicatePrompt = () => {
    setDuplicateConfirmOpen(false);
    setTypedDuplicateReason(null);
    setPendingSaveData(null);
  };

  const handleDuplicateDialogOpenChange = (open: boolean) =>
    open ? setDuplicateConfirmOpen(true) : clearDuplicatePrompt();

  const validationErrorSummary = useMemo(() => {
    const messages = Object.values(errors).filter(Boolean);
    const reasonMessage = typedDuplicateReason ? t(DUPLICATE_ERROR_KEYS[typedDuplicateReason]) : "";
    if (reasonMessage) messages.push(reasonMessage);
    return messages.length > 0 ? [...new Set(messages)] : undefined;
  }, [errors, typedDuplicateReason, t]);

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
      setSaving,
      setPendingSaveData,
      setTypedDuplicateReason,
      setDuplicateConfirmOpen,
      userAccountDraft,
      linkedUser,
      onUserInvalidate: () => invalidateUsersQueries(queryClient),
    });
  };

  const confirmDuplicateSave = () => {
    void confirmPendingFacultySave({
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
    });
  };

  return {
    saving,
    errors,
    setErrors,
    handleSave,
    confirmDuplicateSave,
    validationErrorSummary,
    pendingSaveData,
    typedDuplicateReason,
    duplicateConfirmOpen,
    clearDuplicatePrompt,
    handleDuplicateDialogOpenChange,
  };
}
