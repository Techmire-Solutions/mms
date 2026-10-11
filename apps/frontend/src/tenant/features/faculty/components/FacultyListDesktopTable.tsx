import React, { useMemo } from "react";
import type { Faculty } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ModuleTableFooterCount } from "@/components/ui/ModuleTableFooterCount";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { FacultyListRowActions } from "@/tenant/features/faculty/components/FacultyListRowActions";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/ui/ModuleRowActionsMenu";
import type { FacultySortField } from "@/tenant/features/faculty/components/facultyListTypes";
import type { FacultyListContentProps } from "@/tenant/features/faculty/components/facultyListContentShared";
import {
  getFacultyVisibleWorkColumns,
  facultyWorkColumnHeadClass,
  facultyWorkColumnCellClass,
} from "@/tenant/features/faculty/components/facultyListVisibleColumns";
import { facultyRowIdentity } from "@/tenant/features/faculty/components/facultyFieldDisplay";
import { renderFacultyWorkColumnValue } from "@/tenant/features/faculty/components/facultyWorkColumnCell";

export type FacultyListDesktopTableProps = FacultyListContentProps;

export function FacultyListDesktopTable(props: FacultyListDesktopTableProps): React.JSX.Element {
  const {
    faculty = [],
    selectedIds,
    allSelected,
    someSelected,
    showDeleted,
    canWrite,
    canDelete,
    isColumnVisible,
    columnRegistry,
    customFieldsById,
    statusConfig,
    sortField,
    sortDir,
    getColumnWidth,
    onColumnResize,
    onSort,
    onSelectAll,
    onSelectOne,
    onView,
    onEdit,
    onRequestDelete,
    onRestore,
    onSms,
    onWhatsApp,
    onEmail,
  } = props;
  const items = faculty;
  const { t } = useTranslation();
  const emptyDash = t("faculty.table.emptyDash");

  const visibleColumns = getFacultyVisibleWorkColumns(columnRegistry, isColumnVisible);

  const handleSort = (field: string) => onSort(field as FacultySortField);

  const pageCountLabel = formatDirectoryPageCountLabel(items.length, t, {
    singular: "faculty.form.faculty",
    plural: "faculty.table.faculty",
  });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const batchColumns = useMemo<WorkBatchTableColumn<Faculty>[]>(() => {
    return visibleColumns.map((col) => ({
      id: col.key,
      label: col.label,
      sortField: col.key,
      width: getColumnWidth?.(col.key) ?? col.width,
      headerClassName: col.key !== "name" ? facultyWorkColumnHeadClass(col.key) : undefined,
      cellClassName: col.key !== "name" ? facultyWorkColumnCellClass(col.key) : undefined,
      render: (member) => {
        if (col.key === "name") {
          const { displayName } = facultyRowIdentity(member, selectedSet, t);
          return (
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar
                id={member.id}
                name={displayName}
                avatar={member.avatar}
                gender={member.gender}
                size="md"
                className="shrink-0"
              />
              <div className="min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onView(member)}
                  className="min-h-11 h-auto max-w-full p-0 text-sm font-semibold text-foreground hover:text-primary transition-colors text-start justify-start hover:bg-transparent"
                  title={displayName}
                  aria-label={displayName}
                >
                  <span className="block truncate">{displayName}</span>
                </Button>
                {member.employeeId ? (
                  <p className="text-xs text-muted-foreground truncate" title={member.employeeId}>
                    {member.employeeId}
                  </p>
                ) : null}
                {showDeleted && member.deletionReason ? (
                  <p
                    className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
                    title={member.deletionReason}
                  >
                    {t("faculty.deletionReasonLabel")}: {member.deletionReason}
                  </p>
                ) : null}
              </div>
            </div>
          );
        }

        return renderFacultyWorkColumnValue(member, col.key, {
          t,
          statusConfig,
          customFieldsById,
          emptyFallback: <span className="text-sm text-muted-foreground">{emptyDash}</span>,
        });
      },
    }));
  }, [
    visibleColumns,
    getColumnWidth,
    selectedSet,
    t,
    onView,
    showDeleted,
    statusConfig,
    customFieldsById,
    emptyDash,
  ]);

  return (
    <>
      <WorkBatchTable
        data={items}
        columns={batchColumns}
        selection={{
          selectedIds: selectedSet,
          onSelectOne: (id) => onSelectOne(id),
          onSelectAll,
          allSelected,
          someSelected,
          selectAllAriaLabel: allSelected ? t("common.deselect") : t("faculty.table.selectAll"),
          selectRowAriaLabel: (member) => {
            const { displayName } = facultyRowIdentity(member, selectedSet, t);
            return t("faculty.table.selectFaculty", { name: displayName });
          },
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
        actionsLabel={t("faculty.table.actions")}
        renderRowActions={(facultyMember) => {
          const { facultyIdStr } = facultyRowIdentity(facultyMember, selectedSet, t);
          return (
            <FacultyListRowActions
              faculty={facultyMember}
              facultyId={facultyIdStr}
              showDeleted={showDeleted}
              canWrite={canWrite}
              canDelete={canDelete}
              triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
              onEdit={onEdit}
              onRequestDelete={onRequestDelete}
              onView={onView}
              onRestore={onRestore}
              onSms={onSms}
              onWhatsApp={onWhatsApp}
              onEmail={onEmail}
            />
          );
        }}
        stickyColumnId="name"
      />
      <ModuleTableFooterCount
        selectedCount={selectedIds.length}
        selectedCountLabel={t("faculty.selectedCount", { count: selectedIds.length })}
        pageCountLabel={pageCountLabel}
      />
    </>
  );
}
