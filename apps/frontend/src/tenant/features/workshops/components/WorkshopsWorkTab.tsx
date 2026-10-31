/**
 * @file WorkshopsWorkTab.tsx
 * @description Workshops Work tier — toolbar, bulk chrome, directory and detail drawer.
 */

import React, { useState } from "react";
import { Presentation } from "lucide-react";
import { WORKSHOPS_MODULE_MANIFEST, type WorkshopEvent } from "@mms/shared";
import { WorkTaskToolbar } from "@/components/common/work/WorkTaskToolbar";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import { ErrorState } from "@/components/app/ErrorState";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkshopsColumnLayout } from "../hooks/useWorkshopsColumnLayout";
import { WorkshopsDirectory } from "./WorkshopsDirectory";
import { WorkshopDetailDrawer } from "./WorkshopDetailDrawer";

/** Focus target for the module search shortcut (`/` or Cmd/Ctrl+K). */
export const WORKSHOPS_SEARCH_INPUT_ID = "workshops-search-input";

export interface WorkshopsWorkTabProps {
  workshops: WorkshopEvent[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  canWrite: boolean;
  canDelete: boolean;
  viewingDeleted: boolean;
  selectedIds: string[];
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection: () => void;
  onToggleTrash: (next: boolean) => void;
  onEdit: (workshop: WorkshopEvent) => void;
  onDelete: (ids: string[]) => void;
  onRestore: (id: string) => void;
}

export function WorkshopsWorkTab({
  workshops,
  isLoading,
  isError,
  onRetry,
  search,
  onSearchChange,
  canWrite,
  canDelete,
  viewingDeleted,
  selectedIds,
  onToggleSelected,
  onToggleSelectAll,
  onClearSelection,
  onToggleTrash,
  onEdit,
  onDelete,
  onRestore,
}: WorkshopsWorkTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<WorkshopEvent | null>(null);
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const {
    columnRegistry,
    isColumnVisible,
    getColumnWidth,
    setColumnWidth,
    updateUserColumnLayout,
    resetColumnLayout,
    customizerLabels,
  } = useWorkshopsColumnLayout();

  return (
    <div className="space-y-3">
      <WorkTaskToolbar
        regionLabel={t("nav.workshops")}
        shownCountLabel={t("workshops.shownCount", { count: workshops.length })}
        search={search}
        onSearchChange={onSearchChange}
        searchId={WORKSHOPS_SEARCH_INPUT_ID}
        searchPlaceholder={t("workshops.searchPlaceholder")}
        trashToggle={
          canDelete
            ? {
                canViewDeleted: canDelete,
                viewingDeleted,
                onToggle: onToggleTrash,
                activeLabel: t("workshops.showActive"),
                deletedLabel: t("workshops.showDeleted"),
              }
            : undefined
        }
        viewModeToggle={{ viewMode, onViewModeChange: setViewMode }}
        columnCustomizer={{
          registry: columnRegistry,
          onUpdate: updateUserColumnLayout,
          onReset: resetColumnLayout,
          labels: customizerLabels,
        }}
      />

      <BulkSelectionBar
        selectedCount={selectedIds.length}
        viewingDeleted={viewingDeleted}
        canDelete={canDelete}
        onRequestBulkDelete={() => {
          onDelete(selectedIds);
          onClearSelection();
        }}
        onRequestBulkRestore={() => {
          for (const id of selectedIds) onRestore(id);
          onClearSelection();
        }}
        onClearSelection={onClearSelection}
        bulkActions={WORKSHOPS_MODULE_MANIFEST.work.bulkActions}
        leadingIcon={Presentation}
        i18nNamespace="workshops"
      />

      {isError ? (
        <ErrorState
          title={t("workshops.loadFailed")}
          description={t("workshops.loadFailedHint")}
          onRetry={onRetry}
        />
      ) : (
        <WorkshopsDirectory
          viewMode={viewMode}
          workshops={workshops}
          selectedIds={selectedIds}
          viewingDeleted={viewingDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          isLoading={isLoading}
          isColumnVisible={isColumnVisible}
          getColumnWidth={getColumnWidth}
          onColumnResize={setColumnWidth}
          onToggleSelected={onToggleSelected}
          onToggleSelectAll={onToggleSelectAll}
          onView={setViewing}
          onEdit={onEdit}
          onDelete={(id) => onDelete([id])}
          onRestore={onRestore}
        />
      )}

      <WorkshopDetailDrawer
        workshop={viewing}
        canWrite={canWrite && !viewingDeleted}
        canDelete={canDelete}
        onClose={() => setViewing(null)}
        onEdit={(workshop) => {
          setViewing(null);
          onEdit(workshop);
        }}
        onRestore={onRestore}
      />
    </div>
  );
}
