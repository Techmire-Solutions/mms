import React from "react";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/ui/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import { EnrollmentRowActions } from "@/tenant/features/enrollments/components/EnrollmentRowActions";
import { renderEnrollmentWorkColumnValue } from "@/tenant/features/enrollments/components/enrollmentWorkColumnCell";
import {
  findEnrollmentStudent,
  type EnrollmentListContentProps,
} from "@/tenant/features/enrollments/components/enrollmentListContentShared";
import type { Enrollment } from "@/lib/data/enrollmentData";

export type EnrollmentsListDesktopTableProps = Omit<
  EnrollmentListContentProps,
  "filteredCount" | "page" | "pageSize" | "onPageChange"
>;

export function EnrollmentsListDesktopTable(
  props: EnrollmentsListDesktopTableProps,
): React.JSX.Element {
  const {
    enrollments,
    students,
    isColumnVisible,
    canSelectEnrollments,
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    canWrite,
    canDelete,
    showDeleted,
    statusConfig,
    paymentConfig,
    formatCurrency,
    getColumnWidth,
    onColumnResize,
    onView,
    onCancel,
    onDelete,
    onRestore,
    onToggleSelectAll,
    onToggleSelectedEnrollment,
    openComposer,
  } = props;
  const { t } = useTranslation();

  const studentsById = React.useMemo(() => {
    const map = new Map<string, (typeof students)[number]>();
    for (const s of students) {
      map.set(String(s.id), s);
    }
    return map;
  }, [students]);
  const selectedIdsSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const columnOptions = React.useMemo(
    () => ({ t, students: studentsById, statusConfig, paymentConfig, formatCurrency }),
    [formatCurrency, paymentConfig, statusConfig, studentsById, t],
  );

  const columns = React.useMemo<WorkBatchTableColumn<Enrollment>[]>(() => {
    const cols: WorkBatchTableColumn<Enrollment>[] = [];

    if (isColumnVisible("student")) {
      cols.push({
        id: "student",
        label: t("enrollments.columns.student"),
        noWrap: true,
        cellClassName: "px-3 py-2.5",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "student", columnOptions),
      });
    }

    if (isColumnVisible("session")) {
      cols.push({
        id: "session",
        label: t("enrollments.columns.session"),
        truncate: true,
        cellClassName: "px-3 py-2.5 text-xs text-foreground max-w-cell-sm",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "session", columnOptions),
      });
    }

    if (isColumnVisible("class")) {
      cols.push({
        id: "class",
        label: t("enrollments.columns.class"),
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "class", columnOptions),
      });
    }

    if (isColumnVisible("enrolledDate")) {
      cols.push({
        id: "enrolledDate",
        label: t("enrollments.columns.enrolledDate"),
        noWrap: true,
        cellClassName: "px-3 py-2.5 font-mono text-xs text-muted-foreground",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "enrolledDate", columnOptions),
      });
    }

    if (isColumnVisible("finalFee")) {
      cols.push({
        id: "finalFee",
        label: t("enrollments.columns.finalFee"),
        headerClassName: "text-end",
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-end font-semibold text-foreground",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "finalFee", columnOptions),
      });
    }

    if (isColumnVisible("status")) {
      cols.push({
        id: "status",
        label: t("enrollments.columns.status"),
        cellClassName: "px-3 py-2.5",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "status", columnOptions),
      });
    }

    if (isColumnVisible("payment")) {
      cols.push({
        id: "payment",
        label: t("enrollments.columns.payment"),
        cellClassName: "px-3 py-2.5",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "payment", columnOptions),
      });
    }

    if (isColumnVisible("notes")) {
      cols.push({
        id: "notes",
        label: t("enrollments.columns.notes"),
        truncate: true,
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground max-w-cell-sm",
        render: (enrollment: Enrollment) =>
          renderEnrollmentWorkColumnValue(enrollment, "notes", columnOptions),
      });
    }

    return cols;
  }, [columnOptions, isColumnVisible, t]);

  return (
    <WorkBatchTable
      data={enrollments}
      columns={columns}
      stickyColumnId={canSelectEnrollments ? "student" : undefined}
      selection={
        canSelectEnrollments
          ? {
              selectedIds,
              onSelectOne: (id) => onToggleSelectedEnrollment(id, !selectedIdsSet.has(id)),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("enrollments.table.selectAll"),
              selectRowAriaLabel: (enrollment) =>
                t("enrollments.table.selectEnrollment", { name: enrollment.studentName }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth,
        onColumnResize,
      }}
      renderRowActions={(enrollment) => {
        const student = findEnrollmentStudent(enrollment, studentsById);
        return (
          <EnrollmentRowActions
            enrollment={enrollment}
            student={student}
            canWrite={canWrite}
            canDelete={canDelete}
            showDeleted={showDeleted}
            triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
            onView={onView}
            onCancel={onCancel}
            onDelete={onDelete}
            onRestore={onRestore}
            openComposer={openComposer}
          />
        );
      }}
      actionsLabel={t("enrollments.columns.actions")}
    />
  );
}
