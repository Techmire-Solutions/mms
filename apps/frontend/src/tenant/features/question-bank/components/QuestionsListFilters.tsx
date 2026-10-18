import type { Dispatch, JSX, SetStateAction } from "react";
import { type ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import { FilterChips } from "@/components/app/FilterChips";
import { WorkTaskToolbar } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionBankFiltersMenuButton } from "@/tenant/features/question-bank/components/QuestionBankFiltersMenuButton";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;

export const QUESTION_BANK_WORK_SEARCH_INPUT_ID = "question-bank-work-search";

interface QuestionsListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  config: QuestionBankConfig;
  search: string;
  filterCats: string[];
  filterDiff: string[];
  hideToolbarAdd: boolean;
  canWrite: boolean;
  canDelete?: boolean;
  showDeleted: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onSearchChange: (value: string) => void;
  onFilterCatsChange: Dispatch<SetStateAction<string[]>>;
  onFilterDiffChange: Dispatch<SetStateAction<string[]>>;
  onAddQuestion: () => void;
}

export function QuestionsListFilters({
  viewMode,
  onViewModeChange,
  config,
  search,
  filterCats,
  filterDiff,
  hideToolbarAdd: _hideToolbarAdd,
  canWrite: _canWrite,
  canDelete = false,
  showDeleted,
  onToggleDeleted,
  columnCustomizer,
  onSearchChange,
  onFilterCatsChange,
  onFilterDiffChange,
  onAddQuestion: _onAddQuestion,
}: QuestionsListFiltersProps): JSX.Element {
  const { t } = useTranslation();

  const toggleCategory = (categoryId: string) =>
    onFilterCatsChange((previous) =>
      previous.includes(categoryId)
        ? previous.filter((id) => id !== categoryId)
        : [...previous, categoryId],
    );
  const toggleDifficulty = (difficulty: string) =>
    onFilterDiffChange((previous) =>
      previous.includes(difficulty)
        ? previous.filter((id) => id !== difficulty)
        : [...previous, difficulty],
    );
  const clearFilters = () => {
    onFilterCatsChange([]);
    onFilterDiffChange([]);
  };
  const activeFilterCount = filterCats.length + filterDiff.length;

  const categoriesById = new Map(config.categories.map((item) => [item.id, item]));
  const categoryChips = filterCats.map((categoryId) => {
    const category = categoriesById.get(categoryId);
    return {
      key: `category:${categoryId}`,
      label: category ? `${category.icon} ${category.name}` : categoryId,
      onRemove: () => toggleCategory(categoryId),
    };
  });
  const difficultyChips = filterDiff.map((difficulty) => ({
    key: `difficulty:${difficulty}`,
    label: config.difficultyLabel(difficulty),
    onRemove: () => toggleDifficulty(difficulty),
  }));

  return (
    <WorkTaskToolbar
      regionLabel={t("page.questionBank.title")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("questionBank.searchPlaceholder")}
      searchId={QUESTION_BANK_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={activeFilterCount > 0}
      onClearFilters={clearFilters}
      clearFiltersLabel={t("questionBank.clearFilters")}
      filterButton={
        <QuestionBankFiltersMenuButton
          config={config}
          filterCats={filterCats}
          filterDiff={filterDiff}
          activeFilterCount={activeFilterCount}
          onToggleCategory={toggleCategory}
          onToggleDifficulty={toggleDifficulty}
          onClearFilters={clearFilters}
        />
      }
      filterChips={
        <FilterChips chips={[...categoryChips, ...difficultyChips]} onClearAll={clearFilters} />
      }
      primaryAction={undefined}
      trashToggle={
        canDelete && onToggleDeleted
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("questionBank.trash.showActive"),
              deletedLabel: t("questionBank.trash.showDeleted"),
            }
          : undefined
      }
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={
        columnCustomizer
          ? {
              registry: columnCustomizer.columnRegistry,
              onUpdate: columnCustomizer.updateUserColumnLayout,
              onReset: columnCustomizer.onResetLayout,
              labels: columnCustomizer.labels,
            }
          : undefined
      }
    />
  );
}
