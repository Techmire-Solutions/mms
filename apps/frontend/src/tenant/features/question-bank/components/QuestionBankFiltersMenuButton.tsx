import type { JSX } from "react";
import { Filter } from "lucide-react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDivider,
  ModuleFilterDropdown,
} from "@/components/ui/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;

interface QuestionBankFiltersMenuButtonProps {
  config: QuestionBankConfig;
  filterCats: string[];
  filterDiff: string[];
  activeFilterCount: number;
  onToggleCategory: (categoryId: string) => void;
  onToggleDifficulty: (difficulty: string) => void;
  onClearFilters: () => void;
}

/** Question Bank Work single Filters menu — category + difficulty groups on shared chrome. */
export function QuestionBankFiltersMenuButton({
  config,
  filterCats,
  filterDiff,
  activeFilterCount,
  onToggleCategory,
  onToggleDifficulty,
  onClearFilters,
}: QuestionBankFiltersMenuButtonProps): JSX.Element {
  const { t } = useTranslation();
  const showCategory = config.isFieldEnabled("categoryId") && config.categories.length > 0;
  const showDifficulty =
    config.isFieldEnabled("difficulty") && config.enabledDifficulties.length > 0;

  return (
    <ModuleFilterDropdown
      label={t("questionBank.filters")}
      activeCount={activeFilterCount}
      icon={Filter}
      clearLabel={t("questionBank.clearFilters")}
      onClear={onClearFilters}
    >
      {showCategory ? (
        <ModuleFilterCheckboxGroup
          label={t("questionBank.filterByCategory")}
          options={config.categories.map((category) => ({
            value: category.id,
            label: `${category.icon} ${category.name}`,
          }))}
          selected={filterCats}
          onToggle={onToggleCategory}
        />
      ) : null}
      {showCategory && showDifficulty ? <ModuleFilterDivider /> : null}
      {showDifficulty ? (
        <ModuleFilterCheckboxGroup
          label={t("questionBank.filterDifficulty")}
          options={config.enabledDifficulties.map((difficulty) => ({
            value: difficulty,
            label: config.difficultyLabel(difficulty),
          }))}
          selected={filterDiff}
          onToggle={onToggleDifficulty}
        />
      ) : null}
    </ModuleFilterDropdown>
  );
}
