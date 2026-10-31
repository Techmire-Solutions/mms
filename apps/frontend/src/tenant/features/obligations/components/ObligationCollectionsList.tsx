import React from "react";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { ModuleTrashConfirmDialogs } from "@/components/app/ModuleTrashConfirmDialogs";
import { ObligationCollectionsListContent } from "@/tenant/features/obligations/components/ObligationCollectionsListContent";
import { ObligationCollectionsListFilters } from "@/tenant/features/obligations/components/ObligationCollectionsListFilters";
import { ObligationsBulkActionBar } from "@/tenant/features/obligations/components/ObligationsBulkActionBar";
import { useObligationCollectionsListModel } from "../hooks/useObligationCollectionsListModel";
import { ObligationInvoiceModals } from "./ObligationInvoiceModals";
import type { ObligationCollectionListProps } from "../lib/obligationCollectionsListTypes";

export type { ObligationCollectionListProps };

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;

export function ObligationCollectionsList({
  collections,
  obligationTypes,
  reps,
  mujtahids,
  onAddNew,
  onView,
  onFilteredCountChange,
  canWrite = true,
  canDelete = true,
  showDeleted = false,
  onToggleShowDeleted,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  selectedIds = [],
  onToggleSelectedCollection,
  onToggleSelectAll,
  onClearSelection,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  columnCustomizer,
  onMessage,
  onViewVoucher,
}: ObligationCollectionListProps) {
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;

  const {
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    printCollection,
    setPrintCollection,
    editorCollection,
    setEditorCollection,
    showEditor,
    setShowEditor,
    pendingTrashId,
    setPendingTrashId,
    confirmBulkOpen,
    setConfirmBulkOpen,
    filtered,
    allVisibleSelected,
    someVisibleSelected,
    paymentModeConfig,
    getContact,
    getRep,
    getMujtahid,
    getObligationType,
    confirmRowTrash,
    confirmBulkTrash,
  } = useObligationCollectionsListModel({
    collections,
    obligationTypes,
    reps,
    mujtahids,
    selectedIds,
    showDeleted,
    onFilteredCountChange,
    onClearSelection,
    onDelete,
    onRestore,
    onBulkDelete,
    onBulkRestore,
  });

  const canBulkTrash = canDelete && Boolean(showDeleted ? onBulkRestore : onBulkDelete);

  return (
    <div className="space-y-4">
      <ObligationCollectionsListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        typeFilter={typeFilter}
        obligationTypes={obligationTypes}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onToggleDeleted={onToggleShowDeleted}
        columnCustomizer={columnCustomizer}
        onSearchChange={setSearch}
        onTypeFilterChange={setTypeFilter}
      />

      {canBulkTrash && (
        <ObligationsBulkActionBar
          selectedCount={selectedIds.length}
          showDeleted={showDeleted}
          canDelete={canDelete}
          onRequestBulkDelete={() => setConfirmBulkOpen(true)}
          onRequestBulkRestore={() => setConfirmBulkOpen(true)}
          onClearSelection={onClearSelection ?? (() => {})}
        />
      )}

      <ObligationCollectionsListContent
        viewMode={viewMode}
        collections={filtered}
        search={search}
        typeFilter={typeFilter}
        selectedIds={selectedIds}
        isColumnVisible={columnVisible}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        canWrite={canWrite}
        canDelete={canDelete}
        showDeleted={showDeleted}
        paymentModeConfig={paymentModeConfig}
        getContact={getContact}
        getRep={getRep}
        getMujtahid={getMujtahid}
        getObligationType={getObligationType}
        getColumnWidth={getColumnWidth}
        onColumnResize={onColumnResize}
        onAddNew={onAddNew}
        onView={onView}
        onPrint={setPrintCollection}
        onToggleSelectAll={(checked) =>
          onToggleSelectAll?.(
            checked,
            filtered.map((col) => col.id),
          )
        }
        onToggleSelectedCollection={(id, checked) => onToggleSelectedCollection?.(id, checked)}
        onTrashAction={(id) => {
          if (showDeleted) void onRestore?.(id);
          else setPendingTrashId(id);
        }}
        onMessage={onMessage}
        onViewVoucher={onViewVoucher}
      />

      <ObligationInvoiceModals
        printCollection={printCollection}
        editorCollection={editorCollection}
        showEditor={showEditor}
        obligationTypes={obligationTypes}
        reps={reps}
        mujtahids={mujtahids}
        onClosePrint={() => setPrintCollection(null)}
        onOpenEditor={(col) => {
          setEditorCollection(col);
          setPrintCollection(null);
          setShowEditor(true);
        }}
        onCloseEditor={() => {
          setShowEditor(false);
          if (editorCollection) {
            setPrintCollection(editorCollection);
          }
          setEditorCollection(null);
        }}
      />

      <ModuleTrashConfirmDialogs
        pendingTrashId={pendingTrashId}
        onPendingTrashIdChange={setPendingTrashId}
        confirmBulkOpen={confirmBulkOpen}
        onConfirmBulkOpenChange={setConfirmBulkOpen}
        showDeleted={showDeleted}
        selectedCount={selectedIds.length}
        i18nNamespace="obligations"
        onConfirmRowTrash={confirmRowTrash}
        onConfirmBulkTrash={confirmBulkTrash}
      />
    </div>
  );
}
