import type { JSX } from "react";
import { Filter } from "lucide-react";
import { QUESTION_STATUSES, type QuestionStatus, type QuestionType } from "@mms/shared";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDivider,
  ModuleFilterDropdown,
} from "@/components/app/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;

interface QuestionBankFiltersMenuButtonProps {
  config: QuestionBankConfig;
  filterCats: string[];
  filterDiff: string[];
  filterStatus: QuestionStatus | "";
  filterType: QuestionType | "";
  activeFilterCount: number;
  onToggleCategory: (categoryId: string) => void;
  onToggleDifficulty: (difficulty: string) => void;
  onFilterStatusChange: (status: QuestionStatus | "") => void;
  onFilterTypeChange: (type: QuestionType | "") => void;
  onClearFilters: () => void;
}

/** Question Bank Work single Filters menu — category + difficulty groups on shared chrome. */
export function QuestionBankFiltersMenuButton({
  config,
  filterCats,
  filterDiff,
  filterStatus,
  filterType,
  activeFilterCount,
  onToggleCategory,
  onToggleDifficulty,
  onFilterStatusChange,
  onFilterTypeChange,
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
      <ModuleFilterDivider />
      <ModuleFilterCheckboxGroup
        label={t("questionBank.filterStatus")}
        options={QUESTION_STATUSES.map((status) => ({
          value: status,
          label: t(`questionBank.status.${status}`),
        }))}
        selected={filterStatus ? [filterStatus] : []}
        onToggle={(status) =>
          onFilterStatusChange(filterStatus === status ? "" : (status as QuestionStatus))
        }
      />
      {config.enabledQuestionTypes.length > 0 ? (
        <>
          <ModuleFilterDivider />
          <ModuleFilterCheckboxGroup
            label={t("questionBank.filterType")}
            options={config.enabledQuestionTypes.map((type) => ({
              value: type,
              label: config.typeLabel(type),
            }))}
            selected={filterType ? [filterType] : []}
            onToggle={(type) =>
              onFilterTypeChange(filterType === type ? "" : (type as QuestionType))
            }
          />
        </>
      ) : null}
    </ModuleFilterDropdown>
  );
}
