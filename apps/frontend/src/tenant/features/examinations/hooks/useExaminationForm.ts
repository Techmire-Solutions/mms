import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { notify } from "@/lib/notify";
import { type Exam } from "@/lib/data/examinationData";
import { toTitleCase } from "@mms/shared";
import { EXAMINATION_FORM_EMPTY } from "../lib/examinationFormConstants";
import {
  isExamDraftDirty,
  validateExamDraft,
  type ExamFormErrors,
  type ExamFormField,
} from "../lib/examFormValidation";
import { isNotifiedMutationError } from "@/lib/notifiedMutationError";

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
  const [touched, setTouched] = useState<Partial<Record<ExamFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const sessions = useSessionsCollection();

  const baseline = exam ?? EXAMINATION_FORM_EMPTY;
  const [examDraft, setExamDraft] = useState<Omit<Exam, "id">>(() => {
    return exam ? { ...exam } : { ...EXAMINATION_FORM_EMPTY };
  });

  // Reset the draft to the exam being edited whenever the dialog (re)opens (render-phase reset).
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevExam, setPrevExam] = useState(exam);
  if (prevOpen !== open || prevExam !== exam) {
    setPrevOpen(open);
    setPrevExam(exam);
    if (open) {
      setExamDraft(exam ? { ...exam } : { ...EXAMINATION_FORM_EMPTY });
      setTouched({});
      setSubmitAttempted(false);
      setServerError(null);
    }
  }

  const validationErrors = validateExamDraft(examDraft);
  const isDirty = isExamDraftDirty(examDraft, baseline);

  const updateDraft = (patch: Partial<typeof examDraft>) => {
    setExamDraft((prev) => ({ ...prev, ...patch }));
    setServerError(null);
    setTouched((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) next[key as ExamFormField] = true;
      return next;
    });
  };

  const errors: Record<string, string> = {};
  for (const [field, code] of Object.entries(validationErrors) as Array<
    [ExamFormField, NonNullable<ExamFormErrors[ExamFormField]>]
  >) {
    if (!touched[field] && !submitAttempted) continue;
    const key =
      code === "passingExceedsTotal"
        ? "examinations.form.validation.passingExceedsTotal"
        : code === "totalInvalid"
          ? "examinations.form.validation.totalInvalid"
          : code === "passingInvalid"
            ? "examinations.form.validation.passingInvalid"
            : code === "durationInvalid"
              ? "examinations.form.validation.durationInvalid"
              : code === "nameRequired"
                ? "examinations.form.validation.nameRequired"
                : code === "dateRequired"
                  ? "examinations.form.validation.dateRequired"
                  : "examinations.form.validation.classRequired";
    errors[field] = t(key);
  }

  const classes = (() =>
    sessions.flatMap((session) =>
      (session.classes || []).map((sessionClass) => ({
        id: sessionClass.id,
        name: `${session.name} - ${sessionClass.name}`,
      })),
    ))();

  const handleSave = async () => {
    setSubmitAttempted(true);
    setServerError(null);
    const allErrors = validateExamDraft(examDraft);
    if (Object.keys(allErrors).length > 0) {
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
      const message = err instanceof Error ? err.message : String(err);
      // The controller already surfaced a toast for API failures; show the detail inline only.
      if (!isNotifiedMutationError(err)) {
        notify.error(t("examinations.form.toast.saveFailed"), { description: message });
      }
      setServerError(message);
    } finally {
      setSaving(false);
    }
  };

  const valid = Object.keys(validationErrors).length === 0;
  const submitError = serverError ?? Object.values(errors)[0] ?? undefined;

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
    isDirty,
  };
}
