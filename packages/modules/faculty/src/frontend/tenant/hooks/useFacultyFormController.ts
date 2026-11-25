import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@mms/fe-core/i18n";
import { useUsersContractList } from "../host/users";
import { useFacultyConfig } from "./useFacultyConfig";
import { facultyStatusOptions } from "../lib/facultyStatusUi";
import { useFacultyStatusConfig, useFacultyLookupOptions } from "./useFacultyStatusConfig";
import { useFacultyDesignations } from "./useFacultyDesignations";
import { useFacultyDepartments, departmentEntitiesToNames } from "./useFacultyDepartments";
import {
  DEFAULT_FACULTY_SETTINGS,
  contactHasEmail,
  contactHasPhone,
  resolveFacultyEnabledTabIds,
  resolveFacultyFieldsMapForColumnSync,
} from "@mms/contracts";
import {
  type FacultyFormControllerOptions,
  type UseFacultyFormControllerOptions,
} from "../lib/facultyFormDraft";
import { DUPLICATE_ERROR_KEYS } from "../lib/facultyFormValidation";
import type { FacultyStatusOption } from "../components/FacultyFormSections";
import { useFacultyAssignableRolesSync } from "./useFacultyFormSync";
import { useWorkspaceToday } from "./useWorkspaceToday";
import { useFacultyDraftState } from "./useFacultyDraftState";
import { useFacultyFormSaveActions } from "./useFacultyFormSaveActions";

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
  const today = useWorkspaceToday();

  const {
    facultyDraft,
    setBaselineSnapshot,
    updateDraft,
    isDirty,
    userAccountDraft,
    setUserAccountDraft,
    linkedContact,
    linkedFacultyContactIds,
    nextEmployeeId,
    isFetchingNextEmployeeId,
    handleRegenerateEmployeeId: baseRegenerateEmployeeId,
  } = useFacultyDraftState({
    faculty: currentFaculty,
    defaultSpecialization,
    autoGenerateId,
    idPrefix,
    settings,
    today,
  });

  const requireContactPhone = settings.requireContactPhone === true;
  const requireContactEmail = settings.requireContactEmail === true;
  const missingRequiredPhone =
    requireContactPhone && linkedContact != null && !contactHasPhone(linkedContact);
  const missingRequiredEmail =
    requireContactEmail && linkedContact != null && !contactHasEmail(linkedContact);

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
    clearEmployeeIdError,
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

  const handleRegenerateEmployeeId = useCallback(async () => {
    clearEmployeeIdError();
    await baseRegenerateEmployeeId();
  }, [clearEmployeeIdError, baseRegenerateEmployeeId]);

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
    requireContactPhone,
    requireContactEmail,
    missingRequiredPhone,
    missingRequiredEmail,
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
