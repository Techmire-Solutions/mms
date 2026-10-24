import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useContactMutations } from "@/tenant/hooks/collections/contacts";
import { useStudentConfig } from "@/hooks/useStandardModuleConfig";
import {
  getInitialStudentDraft,
  studentDraftSnapshot,
} from "@/tenant/features/students/lib/studentFormDraft";
import { useStudentFormLinkedData } from "@/tenant/features/students/hooks/useStudentFormLinkedData";
import { useStudentFormActionHandlers } from "@/tenant/features/students/hooks/useStudentFormActionHandlers";
import { useStudentFormStatusOptions } from "@/tenant/features/students/hooks/useStudentFormStatusOptions";
import { isStudentCreate } from "@/tenant/features/students/hooks/studentFormHandlers";
import { type FieldDefinition, type Student, DEFAULT_STUDENT_ENABLED_TABS } from "@mms/shared";

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
  const [validationErrors, setValidationErrors] = useState<import("@mms/shared").ValidationError[]>(
    [],
  );
  const [studentDraft, setStudentDraft] = useState<Partial<Student>>(() =>
    getInitialStudentDraft({ student, fields }),
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    studentDraftSnapshot(getInitialStudentDraft({ student, fields })),
  );
  const [typedDuplicateReason, setTypedDuplicateReason] = useState<
    import("@mms/shared").StudentDuplicateReason | null
  >(null);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Partial<Student> | null>(null);
  const grManuallyEdited = useRef(false);

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
      grManuallyEdited.current = false;
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
    grManuallyEdited,
    updateDraft,
    t,
  });

  // Autofill next GR for create without marking the form dirty.
  useEffect(() => {
    if (!isStudentCreate(student) || !autoGenerateId || !nextGrNumber) return;
    if (grManuallyEdited.current) return;

    setStudentDraft((prev) => {
      if (prev.grNumber === nextGrNumber) return prev;
      const nextDraft = { ...prev, grNumber: nextGrNumber };
      setBaselineSnapshot(studentDraftSnapshot(nextDraft));
      return nextDraft;
    });
  }, [nextGrNumber, student, autoGenerateId]);

  const actions = useStudentFormActionHandlers({
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
    setPendingSaveData,
    setTypedDuplicateReason,
    setDuplicateConfirmOpen,
    formInstanceId,
    onBaselineReset: (data) => setBaselineSnapshot(studentDraftSnapshot(data)),
  });

  return {
    t,
    dir,
    language,
    saving,
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
    linkedDob,
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
