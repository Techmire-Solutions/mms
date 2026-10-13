import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { notify } from "@/lib/notify";
import { type Exam } from "@/lib/data/examinationData";
import { toTitleCase } from "@mms/shared";
import { EXAMINATION_FORM_EMPTY } from "../lib/examinationFormConstants";

export interface UseExaminationFormOptions {
  open: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSave: (exam: Exam) => void | Promise<void>;
}

export type UseExaminationFormResult = ReturnType<typeof useExaminationForm>;

export function useExaminationForm({ open, exam, onClose, onSave }: UseExaminationFormOptions) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sessions = useSessionsCollection();

  const [examDraft, setExamDraft] = useState<Omit<Exam, "id">>(() => {
    return exam ? { ...exam } : { ...EXAMINATION_FORM_EMPTY };
  });

  useEffect(() => {
    if (!open) return;
    setExamDraft(exam ? { ...exam } : { ...EXAMINATION_FORM_EMPTY });
    setErrors({});
  }, [open, exam]);

  const updateDraft = (patch: Partial<typeof examDraft>) => {
    setExamDraft((prev) => ({ ...prev, ...patch }));
    const patchedKeys = Object.keys(patch);
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of patchedKeys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const classes = (() =>
    sessions.flatMap((session) =>
      (session.classes || []).map((sessionClass) => ({
        id: sessionClass.id,
        name: `${session.name} - ${sessionClass.name}`,
      })),
    ))();

  const handleSave = async () => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (!examDraft.name?.trim()) {
      newErrors.name = t("examinations.form.validation.nameRequired");
    }
    if (!examDraft.date) {
      newErrors.date = t("examinations.form.validation.dateRequired");
    }
    if (!examDraft.classIds || examDraft.classIds.length === 0) {
      newErrors.classIds = t("examinations.form.validation.classRequired");
    }
    if (Number(examDraft.passingMarks) > Number(examDraft.totalMarks)) {
      newErrors.passingMarks = t("examinations.form.validation.passingExceedsTotal");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(t("examinations.form.toast.validationError"));
      return;
    }

    setSaving(true);
    try {
      const examToSave: Exam = {
        ...examDraft,
        name: toTitleCase(examDraft.name || ""),
        id: exam?.id || `ex${crypto.randomUUID()}`,
      };
      await onSave(examToSave);
      notify.success(
        exam ? t("examinations.form.toast.updated") : t("examinations.form.toast.created"),
      );
      onClose();
    } catch (err: unknown) {
      notify.error(t("examinations.form.toast.saveFailed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const valid = !!(
    examDraft.name &&
    examDraft.date &&
    examDraft.classIds &&
    examDraft.classIds.length > 0
  );
  const submitError = Object.values(errors)[0] || undefined;

  const getFieldError = (fieldId: string): string | undefined => errors[fieldId];

  return {
    t,
    exam,
    saving,
    errors,
    submitError,
    examDraft,
    classes,
    updateDraft,
    handleSave,
    valid,
    getFieldError,
  };
}
