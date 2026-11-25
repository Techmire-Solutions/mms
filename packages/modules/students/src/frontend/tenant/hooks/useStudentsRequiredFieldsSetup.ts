import { useMemo, useRef, useState } from "react";
import {
  listStudentRequirableFields,
  setStudentFieldRequired,
  type FieldDefinition,
  type StudentRequirableField,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { safeAudit } from "@mms/fe-core/lib/safeAudit";
import { useStudentFieldConfigMutation, useStudentFieldConfigQuery } from "./useStudentSetupConfig";
import { useStudentMutations } from "./useStudentMutations";

type FieldsMap = Record<string, FieldDefinition[]>;

function requiredSignature(fields: FieldsMap): string {
  return JSON.stringify(listStudentRequirableFields(fields).map((row) => [row.key, row.required]));
}

export interface StudentsRequiredFieldsSetupState {
  rows: StudentRequirableField[];
  /** False until the saved configuration has loaded; editing/saving is blocked before that. */
  ready: boolean;
  loadFailed: boolean;
  isDirty: boolean;
  saving: boolean;
  setRequired: (fieldKey: string, required: boolean) => void;
  save: () => Promise<void>;
}

/** Draft + save flow for Students Setup → Required fields. */
export function useStudentsRequiredFieldsSetup(): StudentsRequiredFieldsSetupState {
  const { t } = useTranslation();
  const query = useStudentFieldConfigQuery();
  const mutation = useStudentFieldConfigMutation();
  const { logSetupAudit } = useStudentMutations();
  const [draftFields, setDraftFields] = useState<FieldsMap | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const ready = query.isSuccess && !query.isPlaceholderData;
  const savedConfig = query.data;
  const savedFields = (savedConfig?.fields ?? {}) as FieldsMap;
  const fields = draftFields ?? savedFields;

  const rows = useMemo(() => listStudentRequirableFields(fields), [fields]);
  const isDirty =
    draftFields !== null && requiredSignature(draftFields) !== requiredSignature(savedFields);

  const setRequired = (fieldKey: string, required: boolean): void => {
    if (!ready) return;
    setDraftFields(setStudentFieldRequired(fields, fieldKey, required));
  };

  const discard = (): void => {
    setDraftFields(null);
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
    ready,
    loadFailed: query.isError,
    isDirty,
    saving,
    setRequired,
    save,
  };
}
