import {
  translateApiMessage,
  translateValidationMessage,
} from "@/lib/forms/translateValidationMessage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { FormModal } from "@/components/app/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  getLanguageDirection,
  normalizeAppLanguage,
  questionBankQuestionWriteSchema,
  type AppLanguageCode,
  type QuestionCategory,
  type QuestionDifficulty,
  type QuestionBankQuestion as Question,
  type QuestionSourceBook,
} from "@mms/shared";
import { createZodFormResolver } from "@/lib/forms/createZodFormResolver";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { QuestionFormClassificationSection } from "@/tenant/features/question-bank/components/QuestionFormClassificationSection";
import { QuestionFormContentSection } from "@/tenant/features/question-bank/components/QuestionFormContentSection";
import { QuestionFormFooterSummary } from "@/tenant/features/question-bank/components/QuestionFormFooterSummary";
import { QuestionFormSourcesSection } from "@/tenant/features/question-bank/components/QuestionFormSourcesSection";
import { sanitizeQuestionDraft } from "@/tenant/features/question-bank/lib/questionFormPayload";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";

import type { QuestionFormDraft, QuestionFormProps } from "../lib/questionFormTypes";

type QuestionFormValues = QuestionFormDraft & { id: string };

function buildQuestionValues(question: Question | null, language: string): QuestionFormValues {
  const defaultLang = normalizeAppLanguage(language);
  return {
    id: question?.id ?? `q${crypto.randomUUID()}`,
    categoryIds: question?.categoryIds ?? [],
    type: question?.type ?? "mcq",
    difficulty: (question?.difficulty as QuestionDifficulty) ?? "easy",
    questionLanguage: (question?.questionLanguage as AppLanguageCode) ?? defaultLang,
    text: question?.text ?? "",
    options: question?.options ? [...question.options] : ["", "", "", ""],
    answer: question?.answer ?? "",
    sourceCitations: question?.sourceCitations ? [...question.sourceCitations] : [],
    version: question?.version,
  } as QuestionFormValues;
}

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
  const [serverError, setServerError] = useState<string | null>(null);

  // Shared validation contract: same resolver + ValidationError shape as the other forms.
  const resolver = useMemo(
    () =>
      createZodFormResolver(questionBankQuestionWriteSchema, {
        resolveMessage: (message) => translateValidationMessage(message, t),
      }) as unknown as Resolver<QuestionFormValues>,
    [t],
  );

  const [defaultValues] = useState(() => buildQuestionValues(question, language));
  const { watch, setValue, setError, clearErrors, handleSubmit, reset, formState } =
    useForm<QuestionFormValues>({
      resolver,
      defaultValues,
      mode: "onSubmit",
    });

  // Re-sync the draft when editing another question record or reopening. The app
  // language is not part of the identity: switching locale must not discard edits.
  useEffect(() => {
    if (!open) return;
    reset(buildQuestionValues(question, language));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- locale is intentionally excluded
  }, [open, question, reset]);

  const questionDraft = watch();

  const errors = useMemo(() => {
    const map: Record<string, string> = {};
    const collect = (source: unknown, prefix = ""): void => {
      if (!source || typeof source !== "object") return;
      for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
        const field = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object" && "message" in value) {
          const message = (value as { message?: unknown }).message;
          if (typeof message === "string") map[field] = message;
          continue;
        }
        collect(value, field);
      }
    };
    collect(formState.errors);
    return map;
  }, [formState.errors]);

  // Stable identity: the memoized form sections compare it by reference.
  const updateDraft = useCallback(
    (patch: Partial<QuestionFormDraft>) => {
      for (const [key, value] of Object.entries(patch)) {
        setValue(key as keyof QuestionFormValues, value as never, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    },
    [setValue],
  );

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

  const onValid = async (data: QuestionFormValues) => {
    setServerError(null);
    const sanitized = sanitizeQuestionDraft(data);
    const parsed = questionBankQuestionWriteSchema.safeParse(sanitized);
    if (!parsed.success) {
      const fieldErrors = mapZodFormErrors(parsed.error, (message) =>
        translateValidationMessage(message, t),
      );
      for (const [path, message] of Object.entries(fieldErrors)) {
        setError(path as Parameters<typeof setError>[0], { type: "server", message });
      }
      setServerError(t("common.formPleaseFixErrors"));
      return;
    }
    clearErrors();
    setSaving(true);
    try {
      await onSave(parsed.data as Question);
      notify.success(question ? t("questionBank.updated") : t("questionBank.saved"));
      onClose();
    } catch (err: unknown) {
      const mapping = mapApiFormError(err, (message) => translateApiMessage(message, t));
      const fieldErrors = mapping.fieldErrors ?? {};
      for (const [path, message] of Object.entries(fieldErrors)) {
        // Same paths the resolver uses, so the server copy lands under the field it belongs to.
        setError(path as Parameters<typeof setError>[0], { type: "server", message });
      }
      // Banner keeps only the residual form-level message; field copy stays inline.
      const fieldMessages = new Set(Object.values(fieldErrors));
      const residual =
        mapping.message && !fieldMessages.has(mapping.message) ? mapping.message : null;
      setServerError(
        residual ?? (Object.keys(fieldErrors).length > 0 ? null : t("questionBank.saveFailed")),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () =>
    handleSubmit(onValid, () => notify.error(t("questionBank.validationFailed")))();

  const footerStart = <QuestionFormFooterSummary questionDraft={questionDraft} />;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={question ? t("questionBank.editQuestion") : t("questionBank.addQuestion")}
      subtitle={t("questionBank.form.subtitle")}
      icon={BookOpen}
      dir={getLanguageDirection(language)}
      cancelLabel={t("questionBank.cancel")}
      saveLabel={t("questionBank.saveQuestion")}
      onSave={handleSave}
      saving={saving}
      error={serverError ? [serverError] : undefined}
      isDirty={formState.isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
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
