import React from "react";
import type { QuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { ModuleWorkListStateShell } from "@/components/ui/ModuleWorkListStateShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionsList } from "./QuestionsList";
import type { useQuestionBankFilters } from "@/tenant/features/question-bank/hooks/useQuestionBankFilters";
import type { useQuestionBankWorkController } from "@/tenant/features/question-bank/hooks/useQuestionBankWorkController";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface QuestionBankListContentProps {
  viewMode: WorkDirectoryViewMode;
  config: QuestionBankConfig;
  filters: ReturnType<typeof useQuestionBankFilters>;
  controller: ReturnType<typeof useQuestionBankWorkController>;
  selectedIds: string[];
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  onRestore?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onToggleSelectedQuestion?: (id: string, checked: boolean) => void;
  onRowClick?: (id: string) => void;
  t: TranslationFunction;
}

export function QuestionBankListContent({
  viewMode,
  config,
  filters,
  controller,
  selectedIds,
  canWrite,
  canDelete,
  showDeleted,
  onRestore,
  onDelete,
  getColumnWidth,
  onColumnResize,
  onToggleSelectedQuestion,
  onRowClick,
  t,
}: QuestionBankListContentProps) {
  const {
    listPage: _listPage,
    setListPage,
    pageQuestions,
    pageQuery,
    serverTotal,
    serverPage,
    serverLimit,
    serverHasMore,
  } = filters;

  const {
    allVisibleSelected,
    someVisibleSelected,
    handleToggleSelectAll,
    setPendingTrashId,
    openEditQuestion,
    columnVisible,
    listMetaFields,
    showSourceCitation,
    difficultyConfig,
    typeConfig,
  } = controller;

  return (
    <ModuleWorkListStateShell
      isError={pageQuery.isError}
      isLoading={pageQuery.isPending}
      isFetching={pageQuery.isFetching}
      onRetry={() => {
        void pageQuery.refetch();
      }}
      errorTitle={t("questionBank.loadFailed")}
      errorHint={t("questionBank.loadFailedHint")}
      viewMode={viewMode}
      skeletonColumnCount={6}
      useServerWork={true}
      pageData={{
        page: serverPage,
        total: serverTotal,
        limit: serverLimit,
        hasMore: serverHasMore,
      }}
      onPageChange={setListPage}
      i18nNamespace="questionBank"
      showPagination={pageQuestions.length > 0}
      loadingLabel={t("common.loading")}
    >
      {pageQuestions.length === 0 ? (
        <EmptyState variant="dashed" title={t("questionBank.noQuestions")} className="py-14" />
      ) : (
        <QuestionsList
          viewMode={viewMode}
          questions={pageQuestions}
          config={config}
          difficultyConfig={difficultyConfig}
          typeConfig={typeConfig}
          listMetaFields={listMetaFields}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          canWrite={canWrite}
          canDelete={canDelete}
          canTrashRows={canDelete && Boolean(showDeleted ? onRestore : onDelete)}
          showDeleted={showDeleted}
          showSourceCitation={showSourceCitation}
          isColumnVisible={columnVisible}
          getColumnWidth={getColumnWidth}
          onColumnResize={onColumnResize}
          onEditQuestion={openEditQuestion}
          onTrashAction={(id) => {
            if (showDeleted) void onRestore?.(id);
            else setPendingTrashId(id);
          }}
          onToggleSelectedQuestion={onToggleSelectedQuestion ?? (() => {})}
          onToggleSelectAll={handleToggleSelectAll}
          onRowClick={onRowClick}
        />
      )}
    </ModuleWorkListStateShell>
  );
}
