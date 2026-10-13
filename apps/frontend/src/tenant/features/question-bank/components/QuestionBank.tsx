import React from "react";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { useQuestionBankFilters } from "@/tenant/features/question-bank/hooks/useQuestionBankFilters";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import type { ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import { QuestionBankTrashDialogs } from "@/tenant/features/question-bank/components/QuestionBankTrashDialogs";
import { QuestionsListFilters } from "@/tenant/features/question-bank/components/QuestionsListFilters";
import { QuestionBankBulkActionBar } from "@/tenant/features/question-bank/components/QuestionBankBulkActionBar";
import { useQuestionBankWorkController } from "@/tenant/features/question-bank/hooks/useQuestionBankWorkController";
import { QuestionBankListContent } from "@/tenant/features/question-bank/components/QuestionBankListContent";
import { useTranslation } from "@/hooks/useTranslation";

interface QuestionBankProps {
  questions: Question[];
  onUpdate: (questions: Question[]) => void | Promise<void>;
  modalOpen?: boolean;
  editQuestion?: Question | null;
  onModalOpenChange?: (open: boolean) => void;
  onEditQuestionChange?: (question: Question | null) => void;
  hideToolbarAdd?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  onFilteredCountChange?: (count: number) => void;
  selectedIds?: string[];
  onToggleSelectedQuestion?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onRowClick?: (id: string) => void;
}

export function QuestionBank({
  questions,
  onUpdate: _onUpdate,
  modalOpen: _controlledOpen,
  editQuestion: _controlledEdit,
  onModalOpenChange,
  onEditQuestionChange,
  hideToolbarAdd = false,
  canWrite = true,
  canDelete = false,
  showDeleted = false,
  onToggleDeleted,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onFilteredCountChange,
  selectedIds = [],
  onToggleSelectedQuestion,
  onToggleSelectAll,
  onClearSelection,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  columnCustomizer,
  onRowClick,
}: QuestionBankProps): React.ReactElement {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  // Config (category/difficulty options) derives from the FULL question list.
  const config = useQuestionBankConfig(questions);
  const filters = useQuestionBankFilters({ showDeleted, onFilteredCountChange });
  const {
    search,
    setSearch,
    filterCats,
    setFilterCats,
    filterDiff,
    setFilterDiff,
    listPage,
    pageQuestions,
  } = filters;

  const controller = useQuestionBankWorkController({
    config,
    pageQuestions,
    selectedIds,
    listPage,
    search,
    filterCats,
    filterDiff,
    showDeleted,
    canDelete,
    onClearSelection,
    onToggleSelectAll,
    onDelete,
    onRestore,
    onBulkDelete,
    onBulkRestore,
    onModalOpenChange,
    onEditQuestionChange,
    isColumnVisible,
  });

  const {
    pendingTrashId,
    setPendingTrashId,
    confirmBulkOpen,
    setConfirmBulkOpen,
    confirmRowTrash,
    confirmBulkTrash,
    canBulkTrash,
    openNewQuestion,
  } = controller;

  return (
    <div className="space-y-4">
      <QuestionsListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        config={config}
        search={search}
        filterCats={filterCats}
        filterDiff={filterDiff}
        hideToolbarAdd={hideToolbarAdd}
        canWrite={canWrite}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onToggleDeleted={onToggleDeleted}
        columnCustomizer={columnCustomizer}
        onSearchChange={setSearch}
        onFilterCatsChange={setFilterCats}
        onFilterDiffChange={setFilterDiff}
        onAddQuestion={openNewQuestion}
      />

      {canBulkTrash && (
        <QuestionBankBulkActionBar
          selectedCount={selectedIds.length}
          showDeleted={showDeleted}
          canDelete={canDelete}
          onRequestBulkDelete={() => setConfirmBulkOpen(true)}
          onRequestBulkRestore={() => setConfirmBulkOpen(true)}
          onClearSelection={onClearSelection ?? (() => {})}
        />
      )}

      <QuestionBankListContent
        viewMode={viewMode}
        config={config}
        filters={filters}
        controller={controller}
        selectedIds={selectedIds}
        canWrite={canWrite}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onRestore={onRestore}
        onDelete={onDelete}
        getColumnWidth={getColumnWidth}
        onColumnResize={onColumnResize}
        onToggleSelectedQuestion={onToggleSelectedQuestion}
        onRowClick={onRowClick}
        t={t}
      />

      <QuestionBankTrashDialogs
        pendingTrashId={pendingTrashId}
        onPendingTrashIdChange={setPendingTrashId}
        confirmBulkOpen={confirmBulkOpen}
        onConfirmBulkOpenChange={setConfirmBulkOpen}
        showDeleted={showDeleted}
        selectedCount={selectedIds.length}
        onConfirmRowTrash={confirmRowTrash}
        onConfirmBulkTrash={confirmBulkTrash}
      />
    </div>
  );
}
