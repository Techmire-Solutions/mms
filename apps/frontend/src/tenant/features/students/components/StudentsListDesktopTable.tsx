import { useMemo } from "react";
import type { Student } from "@mms/shared";
import { ModuleTableFooterCount } from "@/components/app/ModuleTableFooterCount";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { StudentsRowActions } from "@/tenant/features/students/components/StudentsRowActions";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/app/ModuleRowActionsMenu";
import { renderStudentsListDesktopTableCell } from "@/tenant/features/students/components/StudentsListDesktopTableCells";
import type {
  StudentsListContentSortField,
  StudentsListContentTableProps,
} from "@/tenant/features/students/lib/studentsListTypes";
import { getStudentVisibleWorkColumns } from "@/tenant/features/students/lib/studentsListVisibleColumns";

export type StudentsListDesktopTableProps = Pick<
  StudentsListContentTableProps,
  | "paginatedStudents"
  | "sessions"
  | "selectedIds"
  | "allSelected"
  | "someSelected"
  | "viewingDeleted"
  | "canWrite"
  | "canDelete"
  | "canWriteMessaging"
  | "statusBadgeConfig"
  | "isColumnVisible"
  | "columnRegistry"
  | "sortField"
  | "sortDir"
  | "onSort"
  | "onSelectAll"
  | "onSelectOne"
  | "onViewStudent"
  | "onEdit"
  | "onDelete"
  | "onRestore"
  | "onOpenComposer"
  | "getColumnWidth"
  | "onColumnResize"
>;

export function StudentsListDesktopTable({
  paginatedStudents,
  sessions: _sessions,
  selectedIds,
  allSelected,
  someSelected,
  viewingDeleted,
  canWrite,
  canDelete,
  canWriteMessaging,
  statusBadgeConfig,
  isColumnVisible,
  columnRegistry,
  sortField,
  sortDir,
  onSort,
  onSelectAll,
  onSelectOne,
  onViewStudent,
  onEdit,
  onDelete,
  onRestore,
  onOpenComposer,
  getColumnWidth,
  onColumnResize,
}: StudentsListDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const visibleColumns = getStudentVisibleWorkColumns(columnRegistry, isColumnVisible);
  const handleSort = (field: string) => onSort(field as StudentsListContentSortField);

  const pageCountLabel = formatDirectoryPageCountLabel(paginatedStudents.length, t, {
    singular: "students.form.student",
    plural: "students.table.students",
  });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const batchColumns = useMemo<WorkBatchTableColumn<Student>[]>(() => {
    return visibleColumns.map((col) => ({
      id: col.key,
      label: col.label,
      sortField: col.key,
      width: getColumnWidth?.(col.key) ?? col.width,
      render: (studentRow) => {
        return renderStudentsListDesktopTableCell({
          studentRow,
          col,
          studentIdStr: String(studentRow.id),
          displayName: studentRow.name || "",
          emptyDash: t("students.table.emptyDash"),
          statusBadgeConfig,
          onViewStudent,
          viewingDeleted,
          canWriteMessaging: !!canWriteMessaging && !viewingDeleted,
          onOpenComposer,
          t,
        });
      },
    }));
  }, [
    visibleColumns,
    getColumnWidth,
    statusBadgeConfig,
    onViewStudent,
    viewingDeleted,
    canWriteMessaging,
    onOpenComposer,
    t,
  ]);

  return (
    <>
      <WorkBatchTable
        data={paginatedStudents}
        columns={batchColumns}
        selection={{
          selectedIds: selectedSet,
          onSelectOne,
          onSelectAll,
          allSelected,
          someSelected,
          selectAllAriaLabel: allSelected ? t("common.deselect") : t("students.table.selectAll"),
          selectRowAriaLabel: (student) =>
            t("students.table.selectStudent", { name: student.name ?? "Student" }),
        }}
        sort={{
          field: sortField ?? undefined,
          dir: sortDir,
          onSort: handleSort,
        }}
        columnResize={{
          getColumnWidth,
          onColumnResize,
        }}
        actionsLabel={t("students.table.actions")}
        renderRowActions={(studentRow) => (
          <StudentsRowActions
            student={studentRow}
            studentId={String(studentRow.id)}
            viewingDeleted={viewingDeleted}
            canWrite={canWrite}
            canDelete={canDelete}
            includeMessaging={canWriteMessaging && !viewingDeleted}
            triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
            contentClassName="w-44"
            iconClassName="w-4 h-4"
            onViewStudent={onViewStudent}
            onEdit={onEdit}
            onDelete={onDelete}
            onRestore={onRestore}
            onOpenComposer={onOpenComposer}
          />
        )}
        stickyColumnId="name"
      />

      <ModuleTableFooterCount
        selectedCount={selectedSet.size}
        selectedCountLabel={t("students.selectedCount", { count: selectedSet.size })}
        pageCountLabel={pageCountLabel}
      />
    </>
  );
}
