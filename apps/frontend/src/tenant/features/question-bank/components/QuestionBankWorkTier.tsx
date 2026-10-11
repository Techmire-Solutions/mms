import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ErrorState } from "@/components/ui/ErrorState";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionBank as QuestionsPanel } from "@/tenant/features/question-bank/components/QuestionBank";
import type { useQuestionBankColumnLayout } from "@/tenant/features/question-bank/hooks/useQuestionBankColumnLayout";
import type { QuestionBankQuestion } from "@mms/shared";

interface WorkTab {
  id: string;
  label: string;
}

interface QuestionBankWorkTierProps {
  tabs: WorkTab[];
  activeSubTab: string;
  showDeleted: boolean;
  listLoadFailed: boolean;
  questions: QuestionBankQuestion[];
  showQuestionModal: boolean;
  editQuestion: QuestionBankQuestion | null;
  canWrite: boolean;
  canDelete: boolean;
  columnLayout: ReturnType<typeof useQuestionBankColumnLayout>;
  onSubTabChange: (tab: string) => void;
  onToggleDeleted: () => void;
  onRetry: () => void;
  onUpdateQuestions: (questions: QuestionBankQuestion[]) => void | Promise<void>;
  onQuestionModalOpenChange: (open: boolean) => void;
  onEditQuestionChange: (question: QuestionBankQuestion | null) => void;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkRestore: (ids: string[]) => Promise<void>;
  onFilteredCountChange: (count: number) => void;
  onCreatePaper: () => void;
  selectedIds?: string[];
  onToggleSelectedQuestion?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
  onRowClick?: (id: string) => void;
}

export function QuestionBankWorkTier({
  tabs,
  activeSubTab,
  showDeleted,
  listLoadFailed,
  questions,
  showQuestionModal,
  editQuestion,
  canWrite,
  canDelete,
  columnLayout,
  onSubTabChange,
  onToggleDeleted,
  onRetry,
  onUpdateQuestions,
  onQuestionModalOpenChange,
  onEditQuestionChange,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onFilteredCountChange,
  onCreatePaper,
  selectedIds,
  onToggleSelectedQuestion,
  onToggleSelectAll,
  onClearSelection,
  onRowClick,
}: QuestionBankWorkTierProps) {
  const { t } = useTranslation();

  return (
    <ErrorBoundary>
      <SubTabBar
        tabs={tabs.map((tab) => ({ key: tab.id, label: tab.label }))}
        value={activeSubTab}
        onChange={(next) => {
          onSubTabChange(next);
          if (next !== "questions" && showDeleted) onToggleDeleted();
        }}
      />

      {activeSubTab === "questions" && listLoadFailed && (
        <ErrorState
          title={t("questionBank.loadFailed")}
          description={t("questionBank.loadFailedHint")}
          onRetry={onRetry}
        />
      )}

      {activeSubTab === "questions" && !listLoadFailed && (
        <QuestionsPanel
          questions={questions}
          onUpdate={onUpdateQuestions}
          modalOpen={showQuestionModal}
          editQuestion={editQuestion}
          onModalOpenChange={onQuestionModalOpenChange}
          onEditQuestionChange={onEditQuestionChange}
          hideToolbarAdd
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          onToggleDeleted={onToggleDeleted}
          onDelete={onDelete}
          onRestore={onRestore}
          onBulkDelete={onBulkDelete}
          onBulkRestore={onBulkRestore}
          onFilteredCountChange={onFilteredCountChange}
          selectedIds={selectedIds}
          onToggleSelectedQuestion={onToggleSelectedQuestion}
          onToggleSelectAll={onToggleSelectAll}
          onClearSelection={onClearSelection}
          isColumnVisible={columnLayout.isColumnVisible}
          getColumnWidth={columnLayout.getColumnWidth}
          onColumnResize={columnLayout.setColumnWidth}
          onRowClick={onRowClick}
          columnCustomizer={{
            columnRegistry: columnLayout.columnRegistry,
            updateUserColumnLayout: columnLayout.updateUserColumnLayout,
            onResetLayout: columnLayout.resetColumnLayout,
            labels: columnLayout.customizerLabels,
          }}
        />
      )}

      {activeSubTab === "generate" && canWrite && !showDeleted && (
        <section className={`${WORK_SURFACE} p-4 sm:p-5`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="m-0 text-sm font-bold text-foreground">
                {t("questionBank.generatorTitle")}
              </h2>
              <p className="m-0 text-xs text-muted-foreground">
                {t("questionBank.manualPaperGeneratorSubtitle")}
              </p>
            </div>
            <Button type="button" onClick={onCreatePaper} className="w-full sm:w-auto">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {t("questionBank.generator")}
            </Button>
          </div>
        </section>
      )}
    </ErrorBoundary>
  );
}
