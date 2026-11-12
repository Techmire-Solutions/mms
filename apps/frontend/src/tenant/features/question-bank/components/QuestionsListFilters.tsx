import type { Dispatch, JSX, SetStateAction } from "react";
import type { QuestionStatus, QuestionType } from "@mms/shared";
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
  filterStatus: QuestionStatus | "";
  filterType: QuestionType | "";
  hideToolbarAdd: boolean;
  canWrite: boolean;
  canDelete?: boolean;
  showDeleted: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onSearchChange: (value: string) => void;
  onFilterCatsChange: Dispatch<SetStateAction<string[]>>;
  onFilterDiffChange: Dispatch<SetStateAction<string[]>>;
  onFilterStatusChange: (status: QuestionStatus | "") => void;
  onFilterTypeChange: (type: QuestionType | "") => void;
  onAddQuestion: () => void;
}

export function QuestionsListFilters({
  viewMode,
  onViewModeChange,
  config,
  search,
  filterCats,
  filterDiff,
  filterStatus,
  filterType,
  hideToolbarAdd: _hideToolbarAdd,
  canWrite: _canWrite,
  canDelete = false,
  showDeleted,
  onToggleDeleted,
  columnCustomizer,
  onSearchChange,
  onFilterCatsChange,
  onFilterDiffChange,
  onFilterStatusChange,
  onFilterTypeChange,
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
    onFilterStatusChange("");
    onFilterTypeChange("");
  };
  const activeFilterCount =
    filterCats.length + filterDiff.length + (filterStatus ? 1 : 0) + (filterType ? 1 : 0);

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
  const statusChip = filterStatus
    ? [
        {
          key: `status:${filterStatus}`,
          label: t(`questionBank.status.${filterStatus}` as never),
          onRemove: () => onFilterStatusChange(""),
        },
      ]
    : [];
  const typeChip = filterType
    ? [
        {
          key: `type:${filterType}`,
          label: config.typeLabel(filterType),
          onRemove: () => onFilterTypeChange(""),
        },
      ]
    : [];

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
          filterStatus={filterStatus}
          filterType={filterType}
          activeFilterCount={activeFilterCount}
          onToggleCategory={toggleCategory}
          onToggleDifficulty={toggleDifficulty}
          onFilterStatusChange={onFilterStatusChange}
          onFilterTypeChange={onFilterTypeChange}
          onClearFilters={clearFilters}
        />
      }
      filterChips={
        <FilterChips
          chips={[...categoryChips, ...difficultyChips, ...statusChip, ...typeChip]}
          onClearAll={clearFilters}
        />
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
