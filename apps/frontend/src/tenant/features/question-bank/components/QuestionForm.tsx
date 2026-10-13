import React, { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  getLanguageDirection,
  normalizeAppLanguage,
  questionBankQuestionWriteSchema,
  type AppLanguageCode,
  type AppTranslationKey,
  type QuestionCategory,
  type QuestionDifficulty,
  type QuestionBankQuestion as Question,
  type QuestionSourceBook,
} from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { QuestionFormClassificationSection } from "@/tenant/features/question-bank/components/QuestionFormClassificationSection";
import { QuestionFormContentSection } from "@/tenant/features/question-bank/components/QuestionFormContentSection";
import { QuestionFormFooterSummary } from "@/tenant/features/question-bank/components/QuestionFormFooterSummary";
import { QuestionFormSourcesSection } from "@/tenant/features/question-bank/components/QuestionFormSourcesSection";

import type { QuestionFormDraft, QuestionFormProps } from "../lib/questionFormTypes";

export function QuestionForm({
  open,
  question,
  questions,
  onClose,
  onSave,
}: QuestionFormProps): React.JSX.Element {
  const { t, language } = useTranslation();
  const { settings, categories, sourceBooks, updateSettingsAsync } =
    useQuestionBankConfig(questions);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [questionDraft, setQuestionDraft] = useState<QuestionFormDraft>(() => {
    const defaultLang = normalizeAppLanguage(language);
    return {
      categoryIds: question?.categoryIds ?? [],
      type: question?.type ?? "mcq",
      difficulty: (question?.difficulty as QuestionDifficulty) ?? "easy",
      questionLanguage: (question?.questionLanguage as AppLanguageCode) ?? defaultLang,
      text: question?.text ?? "",
      options: question?.options ? [...question.options] : ["", "", "", ""],
      answer: question?.answer ?? "",
      sourceCitations: question?.sourceCitations ? [...question.sourceCitations] : [],
    };
  });

  // Re-sync draft when editing another question record
  useEffect(() => {
    if (!open) return;
    const defaultLang = normalizeAppLanguage(language);
    setQuestionDraft({
      categoryIds: question?.categoryIds ?? [],
      type: question?.type ?? "mcq",
      difficulty: (question?.difficulty as QuestionDifficulty) ?? "easy",
      questionLanguage: (question?.questionLanguage as AppLanguageCode) ?? defaultLang,
      text: question?.text ?? "",
      options: question?.options ? [...question.options] : ["", "", "", ""],
      answer: question?.answer ?? "",
      sourceCitations: question?.sourceCitations ? [...question.sourceCitations] : [],
    });
    setErrors({});
  }, [open, question, language]);

  const updateDraft = (patch: Partial<typeof questionDraft>) => {
    setQuestionDraft((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch);
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of keys) {
        if (next[k]) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  // Inline category/source-book creation in the question form persists to the
  // typed Question Bank preferences (`PUT /api/question-bank/config/preferences`)
  // — never the legacy `question_bank_settings` document-store object.
  const handleCreateCategory = async (created: QuestionCategory): Promise<QuestionCategory[]> => {
    const next = [...(settings.categories ?? []), created];
    await updateSettingsAsync({ ...settings, categories: next });
    return next;
  };

  const handlePersistSourceBook = async (book: QuestionSourceBook): Promise<void> => {
    const current = settings.sourceBooks ?? [];
    const index = current.findIndex((entry) => entry.id === book.id);
    const next =
      index >= 0
        ? current.map((entry) => (entry.id === book.id ? book : entry))
        : [...current, book];
    await updateSettingsAsync({ ...settings, sourceBooks: next });
  };

  const handleRemoveSourceBook = async (bookId: string): Promise<void> => {
    const next = (settings.sourceBooks ?? []).filter((entry) => entry.id !== bookId);
    await updateSettingsAsync({ ...settings, sourceBooks: next });
  };

  const handleSave = async () => {
    setErrors({});
    const candidate = {
      ...questionDraft,
      id: question?.id || `q${crypto.randomUUID()}`,
    };
    const parsed = questionBankQuestionWriteSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(mapZodFormErrors(parsed.error, (message) => t(message as AppTranslationKey)));
      notify.error(t("questionBank.validationFailed"));
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed.data as Question);
      notify.success(question ? t("questionBank.updated") : t("questionBank.saved"));
      onClose();
    } catch (err: unknown) {
      notify.error(t("questionBank.saveFailed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const footerStart = <QuestionFormFooterSummary questionDraft={questionDraft} />;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={question ? t("questionBank.editQuestion") : t("questionBank.addQuestion")}
      subtitle={t("questionBank.form.subtitle")}
      icon={BookOpen}
      lang={language}
      dir={getLanguageDirection(language)}
      cancelLabel={t("questionBank.cancel")}
      saveLabel={t("questionBank.saveQuestion")}
      onSave={handleSave}
      saving={saving}
      saveDisabled={!questionDraft.text?.trim() || questionDraft.categoryIds.length === 0}
      footerStart={footerStart}
      formId="question-form"
    >
      <form
        id="question-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (questionDraft.text?.trim() && questionDraft.categoryIds.length > 0 && !saving) {
            void handleSave();
          }
        }}
        className="space-y-3 pb-6"
      >
        <div className="relative z-raised">
          <QuestionFormClassificationSection
            questionDraft={questionDraft}
            errors={errors}
            updateDraft={updateDraft}
            categories={categories}
            onCreateCategory={handleCreateCategory}
          />
        </div>
        <div className="relative z-sticky">
          <QuestionFormContentSection
            questionDraft={questionDraft}
            errors={errors}
            updateDraft={updateDraft}
          />
        </div>
        <div className="relative z-elevated">
          <QuestionFormSourcesSection
            questionDraft={questionDraft}
            updateDraft={updateDraft}
            sourceBooks={sourceBooks}
            onPersistBook={handlePersistSourceBook}
            onRemoveBook={handleRemoveSourceBook}
          />
        </div>
      </form>
    </FormModal>
  );
}
