import { memo } from "react";
import { Tag } from "lucide-react";
import {
  APP_LANGUAGES,
  formatLanguageSelectLabel,
  type AppLanguageCode,
  type AppTranslationKey,
  type QuestionCategory,
  type QuestionDifficulty,
} from "@mms/contracts";
import { SectionCard } from "@mms/ui";
import { Field, FieldErrorMessage } from "@mms/fe-core/components/FormPrimitives";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { useTranslation } from "@mms/fe-core/i18n";
import { CategorySelector } from "./CategorySelector";

import type {
  QuestionFormDraft,
  QuestionFormErrors,
  UpdateQuestionDraft,
} from "../lib/questionFormTypes";

interface QuestionFormClassificationSectionProps {
  questionDraft: QuestionFormDraft;
  errors: QuestionFormErrors;
  updateDraft: UpdateQuestionDraft;
  categories: QuestionCategory[];
  onCreateCategory: (
    category: QuestionCategory,
  ) => Promise<QuestionCategory[] | void> | QuestionCategory[] | void;
}

function QuestionFormClassificationSectionComponent({
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
            onChange={(val: any) => updateDraft({ questionLanguage: val as AppLanguageCode })}
            options={APP_LANGUAGES.map((appLanguage: any) => ({
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
            onChange={(val: any) => updateDraft({ difficulty: val as QuestionDifficulty })}
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
          onChange={(ids: any) => {
            const list = Array.isArray(ids) ? ids : [ids].filter(Boolean);
            updateDraft({ categoryIds: list });
          }}
          onCreateCategory={onCreateCategory}
          required
          translate={(key: any) => t(key as AppTranslationKey)}
        />
        <FieldErrorMessage message={errors.categoryIds} />
      </SectionCard>
    </div>
  );
}

/**
 * Memoized so typing in the stem does not re-render the classification card.
 * `updateDraft` and the config arrays are stable (`useCallback`/`useMemo`).
 */
export const QuestionFormClassificationSection = memo(
  QuestionFormClassificationSectionComponent,
  (prev: any, next: any) =>
    prev.questionDraft.categoryIds === next.questionDraft.categoryIds &&
    prev.questionDraft.difficulty === next.questionDraft.difficulty &&
    prev.questionDraft.questionLanguage === next.questionDraft.questionLanguage &&
    prev.errors === next.errors &&
    prev.categories === next.categories &&
    prev.updateDraft === next.updateDraft &&
    prev.onCreateCategory === next.onCreateCategory,
);
