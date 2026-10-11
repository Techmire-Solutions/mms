import { Tag } from "lucide-react";
import {
  APP_LANGUAGES,
  formatLanguageSelectLabel,
  type AppLanguageCode,
  type AppTranslationKey,
  type QuestionCategory,
  type QuestionDifficulty,
} from "@mms/shared";
import { SectionCard } from "@/components/ui/SectionCard";
import { Field, FieldErrorMessage } from "@/components/ui/FormPrimitives";
import { FormSelect } from "@/components/ui/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { CategorySelector } from "@/tenant/features/question-bank/components/CategorySelector";

import type {
  QuestionFormDraft,
  QuestionFormErrors,
  UpdateQuestionDraft,
} from "./questionFormTypes";

interface QuestionFormClassificationSectionProps {
  questionDraft: QuestionFormDraft;
  errors: QuestionFormErrors;
  updateDraft: UpdateQuestionDraft;
  categories: QuestionCategory[];
  onCreateCategory: (
    category: QuestionCategory,
  ) => Promise<QuestionCategory[] | void> | QuestionCategory[] | void;
}

export function QuestionFormClassificationSection({
  questionDraft,
  errors,
  updateDraft,
  categories,
  onCreateCategory,
}: QuestionFormClassificationSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-5 text-start">
      <SectionCard
        accentColor="primary"
        icon={Tag}
        title={t("questionBank.form.classification")}
        className="shadow-sm"
      >
        <Field id="qb-question-language" label={t("questionBank.form.questionLanguage")}>
          <FormSelect
            id="qb-question-language"
            name="questionLanguage"
            value={questionDraft.questionLanguage}
            onChange={(val) => updateDraft({ questionLanguage: val as AppLanguageCode })}
            options={APP_LANGUAGES.map((appLanguage) => ({
              value: appLanguage.code,
              label: formatLanguageSelectLabel(appLanguage),
            }))}
          />
        </Field>

        <Field id="qb-difficulty" label={t("questionBank.form.difficulty")}>
          <FormSelect
            id="qb-difficulty"
            name="difficulty"
            value={questionDraft.difficulty}
            onChange={(val) => updateDraft({ difficulty: val as QuestionDifficulty })}
            options={[
              { value: "easy", label: t("questionBank.difficulty.easy") },
              { value: "medium", label: t("questionBank.difficulty.medium") },
              { value: "hard", label: t("questionBank.difficulty.hard") },
            ]}
          />
        </Field>

        <CategorySelector
          multiple
          categories={categories}
          value={questionDraft.categoryIds}
          onChange={(ids) => {
            const list = Array.isArray(ids) ? ids : [ids].filter(Boolean);
            updateDraft({ categoryIds: list });
          }}
          onCreateCategory={onCreateCategory}
          required
          translate={(key) => t(key as AppTranslationKey)}
        />
        <FieldErrorMessage message={errors.categoryIds} />
      </SectionCard>
    </div>
  );
}
