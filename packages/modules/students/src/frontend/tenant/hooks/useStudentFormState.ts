import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { useGlobalSettings } from "@mms/fe-core/lib/useGlobalSettings";
import { useContactMutations } from "../host/contactsCollection";
import { useStudentConfig } from "../host/useStudentConfig";
import { getInitialStudentDraft, studentDraftSnapshot } from "../lib/studentFormDraft";
import { useStudentFormLinkedData } from "./useStudentFormLinkedData";
import { useStudentFormActionHandlers } from "./useStudentFormActionHandlers";
import { useStudentFormStatusOptions } from "./useStudentFormStatusOptions";
import { isStudentCreate } from "./studentFormHandlers";
import {
  type FieldDefinition,
  type Student,
  DEFAULT_STUDENT_ENABLED_TABS,
  formatDate,
} from "@mms/contracts";

interface UseStudentFormStateOptions {
  student?: Partial<Student> | null;
  onClose: () => void;
  onSave: (student: Student) => void | Promise<void>;
}

export function useStudentFormState({ student, onClose, onSave }: UseStudentFormStateOptions) {
  const { t, dir } = useTranslation();
  const { language } = useGlobalSettings();
  const { updateContact } = useContactMutations();
  const {
    settings,
    statuses: configStatuses,
    isFieldEnabled,
    isFieldRequired,
  } = useStudentConfig();

  const formInstanceId = String(student?.id ?? "new");
  const settingsFields = settings.fields;
  const fields = useMemo(
    () => (settingsFields || {}) as Record<string, FieldDefinition[]>,
    [settingsFields],
  );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    import("@mms/contracts").ValidationError[]
  >([]);
  const [studentDraft, setStudentDraft] = useState<Partial<Student>>(() =>
    getInitialStudentDraft({ student, fields }),
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    studentDraftSnapshot(getInitialStudentDraft({ student, fields })),
  );
  const [typedDuplicateReason, setTypedDuplicateReason] = useState<
    import("@mms/contracts").StudentDuplicateReason | null
  >(null);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Partial<Student> | null>(null);
  const [isGrManuallyEdited, setIsGrManuallyEdited] = useState(false);
  const [contactDobOverride, setContactDobOverride] = useState<string | null>(null);

  const { statusBadgeConfig, statusSelectOptions, handleUpdateStatuses } =
    useStudentFormStatusOptions(t, configStatuses, studentDraft.status);

  const prevStudentId = useRef(student?.id);
  const prevFieldsRef = useRef(fields);
  const prevFieldsStr = useRef(JSON.stringify(fields));

  useEffect(() => {
    const studentChanged = student?.id !== prevStudentId.current;
    let fieldsChanged = false;
    let currentFieldsStr = prevFieldsStr.current;
    if (fields !== prevFieldsRef.current) {
      currentFieldsStr = JSON.stringify(fields);
      fieldsChanged = currentFieldsStr !== prevFieldsStr.current;
      prevFieldsRef.current = fields;
    }

    if (!studentChanged && !fieldsChanged) {
      return;
    }

    prevStudentId.current = student?.id;
    prevFieldsStr.current = currentFieldsStr;

    if (studentChanged) {
      const nextDraft = getInitialStudentDraft({ student, fields });
      setStudentDraft(nextDraft);
      setBaselineSnapshot(studentDraftSnapshot(nextDraft));
      setValidationErrors([]);
      setFormError(null);
      setIsGrManuallyEdited(false);
      setContactDobOverride(null);
    } else if (fieldsChanged) {
      setStudentDraft((prev) => {
        const nextDraft = getInitialStudentDraft({ student, fields });
        const nextMerged = { ...nextDraft, ...prev };
        return nextMerged;
      });
    }
  }, [student, fields]);

  const updateDraft = (patch: Partial<Student>) => {
    setStudentDraft((prev) => ({ ...prev, ...patch }));
  };

  const isDirty = studentDraftSnapshot(studentDraft) !== baselineSnapshot;
  const enabledTabs = new Set(settings.enabledTabs || DEFAULT_STUDENT_ENABLED_TABS);

  const getFieldError = (fieldId: string) => {
    const fieldError = validationErrors.find(
      (validationError) => validationError.fieldId === fieldId,
    );
    return fieldError ? fieldError.message : undefined;
  };

  const {
    linkedContact,
    linkedGenderRaw,
    linkedGenderLabel,
    linkedDob,
    nextGrNumber,
    autoGenerateId,
    handleGrNumberChange,
    excludeIds,
    isGrAutoAssigned,
  } = useStudentFormLinkedData({
    student,
    studentDraft,
    settings,
    isGrManuallyEdited,
    setIsGrManuallyEdited,
    updateDraft,
    t,
  });

  // Autofill next GR for create without marking the form dirty.
  const [prevAutoGr, setPrevAutoGr] = useState<string | undefined>(undefined);
  if (
    isStudentCreate(student) &&
    autoGenerateId &&
    nextGrNumber &&
    !isGrManuallyEdited &&
    prevAutoGr !== nextGrNumber
  ) {
    setPrevAutoGr(nextGrNumber);
    if (!studentDraft.grNumber || studentDraft.grNumber === prevAutoGr) {
      const nextDraft = { ...studentDraft, grNumber: nextGrNumber };
      setStudentDraft(nextDraft);
      setBaselineSnapshot(studentDraftSnapshot(nextDraft));
    }
  }

  const rawDob = contactDobOverride !== null ? contactDobOverride : (linkedContact?.dob ?? "");
  const effectiveLinkedDob = rawDob.trim() ? formatDate(rawDob.trim()) : linkedDob;

  const actions = useStudentFormActionHandlers({
    student,
    studentDraft,
    linkedContact,
    nextGrNumber,
    autoGenerateId,
    settings,
    enabledTabs: enabledTabs as Set<string>,
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
    onBaselineReset: (data) => setBaselineSnapshot(studentDraftSnapshot(data)),
    contactDobOverride,
    setContactDobOverride,
  });

  return {
    t,
    dir,
    language,
    saving,
    formError,
    studentDraft,
    statusBadgeConfig,
    statusSelectOptions,
    statuses: configStatuses,
    onUpdateStatuses: handleUpdateStatuses,
    fields,
    formInstanceId,
    getFieldError,
    linkedContact,
    linkedGenderRaw,
    linkedGenderLabel,
    linkedDob: effectiveLinkedDob,
    rawDob,
    duplicateConfirmOpen,
    typedDuplicateReason,
    excludeIds,
    isGrAutoAssigned,
    grInputDisabled: autoGenerateId && isStudentCreate(student),
    autoGenerateId,
    nextGrNumber,
    isCreate: isStudentCreate(student),
    isDirty,
    isFieldEnabled,
    isFieldRequired,
    handleGrNumberChange,
    updateDraft,
    ...actions,
  };
}
