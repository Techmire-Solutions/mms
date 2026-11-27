import React, { type JSX } from "react";
import {
  formatQuestionSourcesCitation,
  getQuestionCategoryIds,
  type QuestionBankQuestion as Question,
} from "@mms/contracts";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@mms/ui/app/ModuleRowActionsMenu";
import { useTranslation } from "@mms/fe-core/i18n";
import type { useQuestionBankConfig } from "../hooks/useQuestionBankConfig";
import { CategoryColorChip } from "./CategoryColorChip";
import { QuestionsRowActions } from "./QuestionsRowActions";
import { WorkBatchTable, type WorkBatchTableColumn } from "../host/WorkBatchTable";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;

interface QuestionsListDesktopTableProps {
  questions: Question[];
  config: QuestionBankConfig;
  difficultyConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  selectedIds: string[];
  canWrite: boolean;
  canDelete: boolean;
  canTrashRows: boolean;
  showDeleted: boolean;
  isColumnVisible: (key: string) => boolean;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onEditQuestion: (question: Question) => void;
  onTrashAction: (id: string) => void;
  onToggleSelectedQuestion: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onRowClick?: (id: string) => void;
}

export function QuestionsListDesktopTable({
  questions,
  config,
  difficultyConfig,
  typeConfig,
  selectedIds,
  canWrite,
  canDelete,
  canTrashRows,
  showDeleted,
  isColumnVisible,
  allVisibleSelected,
  someVisibleSelected,
  getColumnWidth,
  onColumnResize,
  onEditQuestion,
  onTrashAction,
  onToggleSelectedQuestion,
  onToggleSelectAll,
  onRowClick,
}: QuestionsListDesktopTableProps): JSX.Element {
  const { t } = useTranslation();
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const categoryMap = React.useMemo(
    () => new Map(config.categories.map((cat: any) => [cat.id, cat])),
    [config.categories],
  );

  const columns = React.useMemo<WorkBatchTableColumn<Question>[]>(() => {
    const cols: WorkBatchTableColumn<Question>[] = [];

    if (isColumnVisible("text")) {
      cols.push({
        id: "text",
        kind: "longText",
        label: t("questionBank.columns.text"),
        cellClassName: "max-w-sidebar-mobile font-semibold",
        render: (question: any) => <p className="m-0 line-clamp-2">{question.text}</p>,
      });
    }

    if (isColumnVisible("category")) {
      cols.push({
        id: "category",
        kind: "shortText",
        label: t("questionBank.columns.category"),
        render: (question: any) => (
          <div className="flex flex-wrap gap-1">
            {getQuestionCategoryIds(question).map((categoryId: any) => {
              const category = categoryMap.get(categoryId);
              if (!category) return null;
              return (
                <CategoryColorChip
                  key={categoryId}
                  name={category.name}
                  color={category.color}
                  icon={category.icon}
                />
              );
            })}
          </div>
        ),
      });
    }

    if (isColumnVisible("language")) {
      cols.push({
        id: "language",
        kind: "shortText",
        label: t("questionBank.columns.language"),
        noWrap: true,
        cellClassName: "text-muted-foreground",
        render: (question: any) => config.questionLanguageLabel(question.questionLanguage),
      });
    }

    if (isColumnVisible("type")) {
      cols.push({
        id: "type",
        kind: "status",
        label: t("questionBank.columns.type"),
        noWrap: true,
        render: (question: any) => (
          <StatusBadge status={question.type} config={typeConfig} size="sm" />
        ),
      });
    }

    if (isColumnVisible("difficulty")) {
      cols.push({
        id: "difficulty",
        kind: "status",
        label: t("questionBank.columns.difficulty"),
        noWrap: true,
        render: (question: any) => (
          <StatusBadge status={question.difficulty} config={difficultyConfig} size="sm" />
        ),
      });
    }

    if (isColumnVisible("source")) {
      cols.push({
        id: "source",
        kind: "shortText",
        label: t("questionBank.columns.source"),
        truncate: true,
        cellClassName: "max-w-cell-lg text-xs text-muted-foreground",
        render: (question: any) =>
          formatQuestionSourcesCitation(question, t, config.sourceBooks) || "—",
      });
    }

    return cols;
  }, [categoryMap, config, difficultyConfig, isColumnVisible, t, typeConfig]);

  return (
    <WorkBatchTable
      data={questions}
      columns={columns}
      caption={t("questionBank.questions")}
      className="table-fixed"
      tableBodyClassName="divide-y divide-border/50"
      stickyColumnId="text"
      onRowClick={onRowClick ? (q: any) => onRowClick(q.id) : undefined}
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id: any) =>
                onToggleSelectedQuestion(String(id), !selectedSet.has(String(id))),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("questionBank.table.selectAll"),
              selectRowAriaLabel: (question: any) =>
                t("questionBank.deleteQuestionAria", { text: question.text }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth,
        onColumnResize,
      }}
      renderRowActions={(question: any) => (
        <QuestionsRowActions
          question={question}
          canWrite={canWrite}
          canDelete={canDelete}
          canTrashRows={canTrashRows}
          showDeleted={showDeleted}
          hideViewItem
          triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
          onEditQuestion={onEditQuestion}
          onTrashAction={onTrashAction}
        />
      )}
    />
  );
}
