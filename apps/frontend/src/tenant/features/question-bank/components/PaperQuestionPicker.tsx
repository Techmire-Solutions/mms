import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT, WORK_SURFACE } from "@/components/ui/formStyles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { FormSelect, type FormSelectOption } from "@/components/ui/FormSelect";
import { getQuestionCategoryIds, type QuestionBankQuestion as Question } from "@mms/shared";
import type {
  DifficultyFilter,
  PaperSection,
} from "@/tenant/features/question-bank/components/paperBuilderUtils";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { CategoryColorChip } from "@/tenant/features/question-bank/components/CategoryColorChip";

interface QuestionCategoryBadge {
  color: string;
  name: string;
}

interface PaperQuestionPickerProps {
  activeSection?: PaperSection;
  categoryById: Map<string, QuestionCategoryBadge>;
  categoryFilter: string;
  categoryOptions: readonly FormSelectOption[];
  difficultyFilter: DifficultyFilter;
  difficultyLabel: (difficulty: Question["difficulty"]) => string;
  difficultyOptions: readonly FormSelectOption[];
  questions: Question[];
  search: string;
  selectedQuestionIds: Set<string>;
  onAddQuestion: (questionId: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onDifficultyFilterChange: (value: DifficultyFilter) => void;
  onSearchChange: (value: string) => void;
}

export function PaperQuestionPicker({
  activeSection,
  categoryById,
  categoryFilter,
  categoryOptions,
  difficultyFilter,
  difficultyLabel,
  difficultyOptions,
  questions,
  search,
  selectedQuestionIds,
  onAddQuestion,
  onCategoryFilterChange,
  onDifficultyFilterChange,
  onSearchChange,
}: PaperQuestionPickerProps): React.ReactElement {
  const { t } = useTranslation();
  const difficultyConfig = (() => ({
    easy: { label: difficultyLabel("easy"), cls: SEMANTIC_BADGE.success },
    medium: { label: difficultyLabel("medium"), cls: SEMANTIC_BADGE.warning },
    hard: { label: difficultyLabel("hard"), cls: SEMANTIC_BADGE.destructive },
  }))() as Record<string, StatusBadgeConfigItem>;

  return (
    <section className={`${WORK_SURFACE} p-3 sm:p-4`}>
      <div className="mb-3">
        <h3 className="m-0 text-sm font-bold text-foreground">
          {t("questionBank.addQuestionsFromBank")}
        </h3>
        <p className="m-0 text-xs text-muted-foreground">
          {activeSection
            ? t("questionBank.addingToSection", { title: activeSection.title })
            : t("questionBank.noActiveSection")}
        </p>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        <Input
          id="paper-picker-search"
          name="search"
          className={`${FORM_INPUT} shadow-none sm:col-span-2 md:col-span-3`}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("questionBank.searchPlaceholder")}
          aria-label={t("questionBank.searchPlaceholder")}
        />
        <FormSelect
          id="paper-picker-category"
          name="categoryFilter"
          aria-label={t("questionBank.category")}
          value={categoryFilter}
          onChange={onCategoryFilterChange}
          options={categoryOptions}
        />
        <FormSelect
          id="paper-picker-difficulty"
          name="difficultyFilter"
          aria-label={t("questionBank.difficulty")}
          value={difficultyFilter}
          onChange={(value) => onDifficultyFilterChange(value as DifficultyFilter)}
          options={difficultyOptions}
        />
      </div>

      <div className="max-h-preview-sm space-y-2 overflow-y-auto pe-1 sm:max-h-preview-md lg:max-h-preview-xl">
        {questions.length === 0 ? (
          <EmptyState
            title={t("questionBank.noQuestionsAvailable")}
            variant="dashed"
            compact
            icon={null}
            className="rounded-lg"
          />
        ) : (
          questions.map((question) => {
            const selected = selectedQuestionIds.has(question.id);
            return (
              <div key={question.id} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <p className="m-0 flex-1 text-xs font-semibold leading-snug text-foreground">
                    {question.text}
                  </p>
                  <Button
                    type="button"
                    onClick={() => onAddQuestion(question.id)}
                    disabled={!activeSection || selected}
                    size="sm"
                    className="min-h-11 w-full px-3 text-xs sm:w-auto"
                  >
                    {selected ? t("questionBank.questionAdded") : t("questionBank.addToPaper")}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {getQuestionCategoryIds(question).map((categoryId) => {
                    const category = categoryById.get(categoryId);
                    if (!category) return null;
                    return (
                      <CategoryColorChip
                        key={categoryId}
                        name={category.name}
                        color={category.color}
                      />
                    );
                  })}
                  <StatusBadge status={question.difficulty} config={difficultyConfig} size="sm" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
