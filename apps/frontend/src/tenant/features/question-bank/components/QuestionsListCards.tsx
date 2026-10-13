import type { JSX } from "react";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { QuestionCard } from "./QuestionCard";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;
type QuestionBankField = QuestionBankConfig["orderedFields"][number];

export interface QuestionsListCardsProps {
  questions: Question[];
  config: QuestionBankConfig;
  difficultyConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  listMetaFields: QuestionBankField[];
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canTrashRows: boolean;
  showDeleted: boolean;
  showSourceCitation: boolean;
  isColumnVisible: (key: string) => boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onEditQuestion: (question: Question) => void;
  onTrashAction: (id: string) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onRowClick?: (id: string) => void;
}

export function QuestionsListCards({
  questions,
  config,
  difficultyConfig,
  typeConfig,
  listMetaFields,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  canWrite,
  canDelete,
  canTrashRows,
  showDeleted,
  showSourceCitation,
  isColumnVisible,
  onToggleSelectAll,
  onEditQuestion,
  onTrashAction,
  onToggleSelected,
  onRowClick,
}: QuestionsListCardsProps): JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const pageCountLabel = formatDirectoryPageCountLabel(questions.length, t, {
    singular: "questionBank.item.question",
    plural: "questionBank.item.questions",
  });

  return (
    <EntityCardsGrid
      items={questions}
      selectedIds={selectedIds}
      onSelectAll={canDelete ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
      allSelected={allVisibleSelected}
      someSelected={someVisibleSelected}
      selectAllLabel={t("questionBank.table.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("questionBank.trash.selected", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="question-bank-select-cards"
      renderItem={(question) => (
        <QuestionCard
          key={question.id}
          question={question}
          config={config}
          difficultyConfig={difficultyConfig}
          typeConfig={typeConfig}
          listMetaFields={listMetaFields}
          selectedIds={selectedIds}
          canWrite={canWrite}
          canDelete={canDelete}
          canTrashRows={canTrashRows}
          showDeleted={showDeleted}
          showSourceCitation={showSourceCitation}
          isColumnVisible={isColumnVisible}
          onEditQuestion={onEditQuestion}
          onTrashAction={onTrashAction}
          onToggleSelected={onToggleSelected}
          onRowClick={onRowClick}
          reducedMotion={reducedMotion}
        />
      )}
    />
  );
}
