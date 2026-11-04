/**
 * @file TasksListCards.tsx
 * @description Cards directory view for Tasks Work tier.
 */

import React, { useMemo } from "react";
import type { TaskRecord, TaskStatus } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { LoadingState } from "@/components/app/LoadingState";
import { ModuleDirectoryCards } from "@/components/app/ModuleDirectoryCards";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { getDirectoryPageSelection } from "@/lib/directorySelection";
import { TaskCardItem } from "./TaskCardItem";

export interface TasksListCardsProps {
  tasks: TaskRecord[];
  selectedIds: string[];
  viewingDeleted: boolean;
  canWrite: boolean;
  canComplete?: boolean;
  statusPending?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  canDelete: boolean;
  isLoading: boolean;
  isColumnVisible: (key: string) => boolean;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onView: (task: TaskRecord) => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onUpdateStatus: (task: TaskRecord, status: TaskStatus) => void;
  emptyAction?: React.ReactNode;
}

export function TasksListCards({
  tasks,
  selectedIds,
  viewingDeleted,
  canWrite,
  canComplete,
  statusPending = false,
  hasActiveFilters = false,
  onClearFilters,
  canDelete,
  isLoading,
  isColumnVisible,
  onToggleSelected,
  onToggleSelectAll,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onUpdateStatus,
  emptyAction,
}: TasksListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const pageIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const { allSelected, someSelected } = getDirectoryPageSelection(pageIds, selectedIds);
  const pageCountLabel = formatDirectoryPageCountLabel(tasks.length, t, {
    singular: "tasks.singular",
    plural: "nav.tasks",
  });

  if (!isLoading && tasks.length === 0) {
    if (hasActiveFilters) {
      return (
        <EmptyState
          title={t("common.dataTable.noMatches")}
          action={
            onClearFilters ? (
              <Button variant="outline" onClick={onClearFilters}>
                {t("common.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <EmptyState
        title={viewingDeleted ? t("tasks.trashEmptyTitle") : t("tasks.emptyTitle")}
        description={
          viewingDeleted ? t("tasks.trashEmptyDescription") : t("tasks.emptyDescription")
        }
        action={!viewingDeleted ? emptyAction : undefined}
      />
    );
  }

  return (
    <div aria-busy={isLoading || undefined}>
      {isLoading && tasks.length === 0 ? (
        <LoadingState title={t("common.loading")} />
      ) : (
        <ModuleDirectoryCards
          items={tasks}
          selectedIds={selectedIds}
          onSelectAll={
            canWrite || canDelete ? () => onToggleSelectAll(!allSelected, pageIds) : undefined
          }
          allSelected={allSelected}
          someSelected={someSelected}
          selectAllLabel={t("common.selectAll")}
          deselectAllLabel={t("common.deselect")}
          selectedCountLabel={t("tasks.selectedCount", { count: selectedIds.length })}
          pageCountLabel={pageCountLabel}
          checkboxIdPrefix="tasks-select-cards"
          renderItem={(task) => (
            <TaskCardItem
              key={task.id}
              task={task}
              selectedIds={selectedIds}
              viewingDeleted={viewingDeleted}
              canWrite={canWrite}
              canComplete={canComplete ?? canWrite}
              statusPending={statusPending}
              canDelete={canDelete}
              isColumnVisible={isColumnVisible}
              onToggleSelected={onToggleSelected}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
              onUpdateStatus={onUpdateStatus}
              reducedMotion={reducedMotion}
            />
          )}
        />
      )}
    </div>
  );
}
