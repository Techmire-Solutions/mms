import React from "react";
import { formatDate } from "@mms/shared";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/app/ModuleRowActionsMenu";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { ExaminationsRowActions } from "@/tenant/features/examinations/components/ExaminationsRowActions";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work";
import type { Exam } from "@/lib/data/examinationData";
import {
  getExamMeta,
  type ExaminationsListContentProps,
} from "@/tenant/features/examinations/lib/examinationsListContentShared";

export type ExaminationsListDesktopTableProps = ExaminationsListContentProps;

export function ExaminationsListDesktopTable(
  props: ExaminationsListDesktopTableProps,
): React.JSX.Element {
  const {
    exams,
    selectedIds,
    isColumnVisible,
    classes,
    enrollments,
    allVisibleSelected,
    someVisibleSelected,
    canWrite,
    canDelete,
    showDeleted,
    canTrashRows,
    statusConfig,
    getColumnWidth,
    onColumnResize,
    onEdit,
    onToggleSelectAll,
    onToggleSelectedExam,
    onTrashAction,
  } = props;
  const { t } = useTranslation();
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const columns = React.useMemo<WorkBatchTableColumn<Exam>[]>(() => {
    const cols: WorkBatchTableColumn<Exam>[] = [];

    if (isColumnVisible("name")) {
      cols.push({
        id: "name",
        label: t("examinations.columns.exam.name"),
        noWrap: true,
        cellClassName: "font-semibold text-foreground",
        render: (exam) => exam.name,
      });
    }

    if (isColumnVisible("subject")) {
      cols.push({
        id: "subject",
        label: t("examinations.columns.exam.subject"),
        cellClassName: "text-muted-foreground",
        render: (exam) => exam.subject,
      });
    }

    if (isColumnVisible("date")) {
      cols.push({
        id: "date",
        label: t("examinations.columns.exam.date"),
        noWrap: true,
        cellClassName: "text-muted-foreground",
        render: (exam) => formatDate(exam.date, true),
      });
    }

    if (isColumnVisible("duration")) {
      cols.push({
        id: "duration",
        label: t("examinations.columns.exam.duration"),
        noWrap: true,
        cellClassName: "text-muted-foreground",
        render: (exam) => t("examinations.durationMinutes", { minutes: exam.duration }),
      });
    }

    if (isColumnVisible("status")) {
      cols.push({
        id: "status",
        label: t("examinations.columns.exam.status"),
        noWrap: true,
        render: (exam) => <StatusBadge status={exam.status} config={statusConfig} size="sm" />,
      });
    }

    if (isColumnVisible("totalMarks")) {
      cols.push({
        id: "totalMarks",
        label: t("examinations.columns.exam.totalMarks"),
        noWrap: true,
        cellClassName: "font-bold text-foreground",
        render: (exam) => exam.totalMarks,
      });
    }

    if (isColumnVisible("passingMarks")) {
      cols.push({
        id: "passingMarks",
        label: t("examinations.columns.exam.passingMarks"),
        noWrap: true,
        cellClassName: "text-foreground",
        render: (exam) => exam.passingMarks,
      });
    }

    if (isColumnVisible("classes")) {
      cols.push({
        id: "classes",
        label: t("examinations.columns.exam.classes"),
        truncate: true,
        cellClassName: "text-xs text-muted-foreground max-w-cell-sm",
        render: (exam) => {
          const { assignedClasses } = getExamMeta(exam, classes, enrollments);
          return assignedClasses.map((sessionClass) => sessionClass.name).join(", ") || "—";
        },
      });
    }

    if (isColumnVisible("description")) {
      cols.push({
        id: "description",
        label: t("examinations.columns.exam.description"),
        truncate: true,
        cellClassName: "text-xs text-muted-foreground max-w-cell-sm",
        render: (exam) => exam.description?.trim() || "—",
      });
    }

    return cols;
  }, [classes, enrollments, isColumnVisible, statusConfig, t]);

  return (
    <WorkBatchTable
      data={exams}
      columns={columns}
      caption={t("examinations.exams")}
      className="table-fixed"
      tableBodyClassName="divide-y divide-border/50"
      onRowClick={props.onRowClick ? (exam) => props.onRowClick?.(exam.id) : undefined}
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id) => onToggleSelectedExam(String(id), !selectedSet.has(String(id))),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("examinations.trash.selectAll"),
              selectRowAriaLabel: (exam) => t("examinations.trash.selectExam", { name: exam.name }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth: (key) => getColumnWidth?.(key),
        onColumnResize,
      }}
      renderRowActions={(exam) => (
        <ExaminationsRowActions
          exam={exam}
          canWrite={canWrite}
          canDelete={canTrashRows}
          showDeleted={showDeleted}
          triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
          onEdit={onEdit}
          onTrashAction={onTrashAction}
        />
      )}
      actionsLabel={t("examinations.columns.actions")}
    />
  );
}
