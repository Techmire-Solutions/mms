import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { useUsersContractList } from "@/tenant/hooks/collections/users";
import { useFacultyConfig } from "@/hooks/useStandardModuleConfig";
import { facultyStatusOptions } from "@/lib/faculty/facultyStatusUi";
import {
  useFacultyStatusConfig,
  useFacultyLookupOptions,
} from "@/tenant/features/faculty/hooks/useFacultyStatusConfig";
import { useFacultyDesignations } from "@/tenant/features/faculty/hooks/useFacultyDesignations";
import {
  useFacultyDepartments,
  departmentEntitiesToNames,
} from "@/tenant/features/faculty/hooks/useFacultyDepartments";
import {
  DEFAULT_FACULTY_SETTINGS,
  resolveFacultyEnabledTabIds,
  resolveFacultyFieldsMapForColumnSync,
} from "@mms/shared";
import {
  type FacultyFormControllerOptions,
  type UseFacultyFormControllerOptions,
} from "@/tenant/features/faculty/lib/facultyFormDraft";
import { DUPLICATE_ERROR_KEYS } from "@/tenant/features/faculty/lib/facultyFormValidation";
import type { FacultyStatusOption } from "@/tenant/features/faculty/components/FacultyFormSections";
import { useFacultyAssignableRolesSync } from "@/tenant/features/faculty/hooks/useFacultyFormSync";
import { useFacultyDraftState } from "@/tenant/features/faculty/hooks/useFacultyDraftState";
import { useFacultyFormSaveActions } from "@/tenant/features/faculty/hooks/useFacultyFormSaveActions";

export type { FacultyFormControllerOptions, UseFacultyFormControllerOptions };

export function useFacultyFormController({
  faculty,
  onClose,
  onSave,
}: FacultyFormControllerOptions) {
  const currentFaculty = faculty;
  const queryClient = useQueryClient();
  const { t, dir, language } = useTranslation();

  const {
    settings,
    isFieldEnabled: configIsFieldEnabled,
    isFieldRequired: configIsFieldRequired,
  } = useFacultyConfig();
  const { statusOptions: statusValues, specializationOptions } = useFacultyLookupOptions();
  const designationDefinitions = useFacultyDesignations();
  const departmentsQuery = useFacultyDepartments();
  const departmentEntities = departmentsQuery.data ?? [];
  const departmentOptions = departmentEntitiesToNames(departmentEntities);

  const defaultSpecialization =
    settings.defaultSpecialization ||
    specializationOptions[0] ||
    DEFAULT_FACULTY_SETTINGS.defaultSpecialization;
  const idPrefix =
    settings.employeeIdPrefix || settings.idPrefix || DEFAULT_FACULTY_SETTINGS.idPrefix;
  const autoGenerateId = settings.autoGenerateId !== false;
  const requireContactLink = true;
  const fieldsMap = resolveFacultyFieldsMapForColumnSync(settings.fields);
  const isFieldEnabled = (fieldId: string) =>
    fieldId === "contactId" ? true : configIsFieldEnabled(fieldId);
  const isFieldRequired = (fieldId: string) =>
    fieldId === "contactId" ? true : configIsFieldRequired(fieldId);
  const statusOptions = facultyStatusOptions(t, statusValues) as FacultyStatusOption[];
  const statusConfig = useFacultyStatusConfig();
  const formInstanceId = String(currentFaculty?.id ?? "new");

  const {
    facultyDraft,
    setFacultyDraft,
    setBaselineSnapshot,
    updateDraft,
    isDirty,
    userAccountDraft,
    setUserAccountDraft,
    linkedContact,
    linkedFacultyContactIds,
    nextEmployeeId,
    isFetchingNextEmployeeId,
    handleRegenerateEmployeeId,
  } = useFacultyDraftState({
    faculty: currentFaculty,
    defaultSpecialization,
    autoGenerateId,
    idPrefix,
    settings,
  });

  const enabledTabs = useMemo(() => new Set(resolveFacultyEnabledTabIds(settings)), [settings]);

  const usersQuery = useUsersContractList({ limit: 100 }, Boolean(facultyDraft.contactId));
  const existingUsers = (
    usersQuery.data as {
      users?: Array<{
        id: string;
        contactId?: string | number;
        email?: string;
        role?: string;
        status?: string;
      }>;
    }
  )?.users;

  const linkedUser = useMemo(() => {
    if (!facultyDraft.contactId && !facultyDraft.userId) return null;
    return (
      existingUsers?.find(
        (u) =>
          (facultyDraft.userId && u.id === facultyDraft.userId) ||
          (facultyDraft.contactId && String(u.contactId) === String(facultyDraft.contactId)),
      ) ?? null
    );
  }, [existingUsers, facultyDraft.contactId, facultyDraft.userId]);

  useFacultyAssignableRolesSync({
    facultyDraft,
    userAccountDraft,
    setUserAccountDraft,
  });

  const {
    saving,
    errors,
    handleSave,
    confirmDuplicateSave,
    validationErrorSummary,
    pendingSaveData,
    typedDuplicateReason,
    duplicateConfirmOpen,
    clearDuplicatePrompt,
    handleDuplicateDialogOpenChange,
  } = useFacultyFormSaveActions({
    facultyDraft,
    faculty: currentFaculty,
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
  });

  const getFieldError = (fieldId: string): string | undefined =>
    errors[fieldId] || errors[`custom:${fieldId}`];

  return {
    t,
    dir,
    language,
    saving,
    errors,
    facultyDraft,
    isDirty,
    defaultSpecialization,
    specializationOptions,
    departmentOptions,
    departmentEntities,
    designationOptions: designationDefinitions.data ?? [],
    statusOptions,
    statusConfig,
    autoGenerateId,
    requireContactLink,
    fieldsMap,
    linkedContact,
    linkedFacultyContactIds,
    linkedUser,
    userAccountDraft,
    setUserAccountDraft,
    idPrefix,
    nextEmployeeId,
    handleRegenerateEmployeeId,
    isFetchingNextEmployeeId,
    formInstanceId,
    isFieldEnabled,
    isFieldRequired,
    getFieldError,
    updateDraft,
    handleSave,
    validationErrorSummary,
    pendingSaveData,
    typedDuplicateReason,
    duplicateConfirmOpen,
    clearDuplicatePrompt,
    handleDuplicateDialogOpenChange,
    confirmDuplicateSave,
    duplicateErrorKeys: DUPLICATE_ERROR_KEYS,
  };
}
