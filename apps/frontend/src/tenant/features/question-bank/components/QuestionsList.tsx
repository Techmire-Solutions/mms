import type { JSX } from "react";
import { type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { QuestionsListDesktopTable } from "@/tenant/features/question-bank/components/QuestionsListDesktopTable";
import { QuestionsListCards } from "@/tenant/features/question-bank/components/QuestionsListCards";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;
type QuestionBankField = QuestionBankConfig["orderedFields"][number];

interface QuestionsListProps {
  viewMode: WorkDirectoryViewMode;
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
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onEditQuestion: (question: Question) => void;
  onTrashAction: (id: string) => void;
  onToggleSelectedQuestion: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onRowClick?: (id: string) => void;
}

export function QuestionsList(props: QuestionsListProps): JSX.Element {
  if (props.viewMode === "cards") {
    return (
      <QuestionsListCards
        questions={props.questions}
        config={props.config}
        difficultyConfig={props.difficultyConfig}
        typeConfig={props.typeConfig}
        listMetaFields={props.listMetaFields}
        selectedIds={props.selectedIds}
        allVisibleSelected={props.allVisibleSelected}
        someVisibleSelected={props.someVisibleSelected}
        canWrite={props.canWrite}
        canDelete={props.canDelete}
        canTrashRows={props.canTrashRows}
        showDeleted={props.showDeleted}
        showSourceCitation={props.showSourceCitation}
        isColumnVisible={props.isColumnVisible}
        onToggleSelectAll={props.onToggleSelectAll}
        onEditQuestion={props.onEditQuestion}
        onTrashAction={props.onTrashAction}
        onToggleSelected={props.onToggleSelectedQuestion}
        onRowClick={props.onRowClick}
      />
    );
  }

  return (
    <QuestionsListDesktopTable
      questions={props.questions}
      config={props.config}
      difficultyConfig={props.difficultyConfig}
      typeConfig={props.typeConfig}
      selectedIds={props.selectedIds}
      canWrite={props.canWrite}
      canDelete={props.canDelete}
      canTrashRows={props.canTrashRows}
      showDeleted={props.showDeleted}
      isColumnVisible={props.isColumnVisible}
      allVisibleSelected={props.allVisibleSelected}
      someVisibleSelected={props.someVisibleSelected}
      getColumnWidth={props.getColumnWidth}
      onColumnResize={props.onColumnResize}
      onEditQuestion={props.onEditQuestion}
      onTrashAction={props.onTrashAction}
      onToggleSelectedQuestion={props.onToggleSelectedQuestion}
      onToggleSelectAll={props.onToggleSelectAll}
      onRowClick={props.onRowClick}
    />
  );
}
