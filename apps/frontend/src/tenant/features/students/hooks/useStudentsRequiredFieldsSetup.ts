import { useMemo, useRef, useState } from "react";
import {
  applyRecommendedStudentRequiredFields,
  listStudentRequirableFields,
  resolveStudentRequiredFieldPreset,
  setStudentFieldRequired,
  type FieldDefinition,
  type StudentRequirableField,
  type StudentRequiredFieldPreset,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { safeAudit } from "@/lib/safeAudit";
import {
  useStudentFieldConfigMutation,
  useStudentFieldConfigQuery,
} from "@/tenant/features/students/hooks/useStudentSetupConfig";
import { useStudentMutations } from "@/tenant/features/students/hooks/useStudentMutations";

type FieldsMap = Record<string, FieldDefinition[]>;

function requiredSignature(fields: FieldsMap): string {
  return JSON.stringify(listStudentRequirableFields(fields).map((row) => [row.key, row.required]));
}

export interface StudentsRequiredFieldsSetupState {
  rows: StudentRequirableField[];
  preset: StudentRequiredFieldPreset;
  /** False until the saved configuration has loaded; editing/saving is blocked before that. */
  ready: boolean;
  loadFailed: boolean;
  isDirty: boolean;
  saving: boolean;
  selectPreset: (preset: StudentRequiredFieldPreset) => void;
  setRequired: (fieldKey: string, required: boolean) => void;
  save: () => Promise<void>;
  discard: () => void;
}

/** Draft + save flow for Students Setup → Required fields. */
export function useStudentsRequiredFieldsSetup(): StudentsRequiredFieldsSetupState {
  const { t } = useTranslation();
  const query = useStudentFieldConfigQuery();
  const mutation = useStudentFieldConfigMutation();
  const { logSetupAudit } = useStudentMutations();
  const [draftFields, setDraftFields] = useState<FieldsMap | null>(null);
  const [presetChoice, setPresetChoice] = useState<StudentRequiredFieldPreset | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const ready = query.isSuccess && !query.isPlaceholderData;
  const savedConfig = query.data;
  const savedFields = (savedConfig?.fields ?? {}) as FieldsMap;
  const fields = draftFields ?? savedFields;

  const rows = useMemo(() => listStudentRequirableFields(fields), [fields]);
  const isDirty =
    draftFields !== null && requiredSignature(draftFields) !== requiredSignature(savedFields);
  const preset = presetChoice ?? resolveStudentRequiredFieldPreset(fields);

  const selectPreset = (next: StudentRequiredFieldPreset): void => {
    if (!ready) return;
    setPresetChoice(next);
    if (next === "recommended") setDraftFields(applyRecommendedStudentRequiredFields(fields));
  };

  const setRequired = (fieldKey: string, required: boolean): void => {
    if (!ready) return;
    setPresetChoice("custom");
    setDraftFields(setStudentFieldRequired(fields, fieldKey, required));
  };

  const discard = (): void => {
    setDraftFields(null);
    setPresetChoice(null);
  };

  const save = async (): Promise<void> => {
    // Synchronous guard: a double click must not send two PUTs.
    if (!ready || !isDirty || !savedConfig || !draftFields || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await mutation.mutateAsync({ ...savedConfig, fields: draftFields });
      safeAudit(
        logSetupAudit.mutateAsync({
          area: "fields",
          summary: t("students.setup.auditSummary", { area: "fields" }),
        }),
        "students.setup_audit",
      );
      notify.success(t("students.setup.requiredFieldsSaved"));
      discard();
    } catch {
      notify.error(t("students.setup.saveFailed"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return {
    rows,
    preset,
    ready,
    loadFailed: query.isError,
    isDirty,
    saving,
    selectPreset,
    setRequired,
    save,
    discard,
  };
}
