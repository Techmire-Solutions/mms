import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { SubTabBar } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionBank as QuestionsPanel } from "@/tenant/features/question-bank/components/QuestionBank";
import type { useQuestionBankColumnLayout } from "@/tenant/features/question-bank/hooks/useQuestionBankColumnLayout";
import type { QuestionBankQuestion, QuestionBankTest } from "@mms/shared";
import { PaperBlueprintPanel } from "./PaperBlueprintPanel";

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
  tests: QuestionBankTest[];
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
  tests,
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
        <PaperBlueprintPanel questions={questions} tests={tests} canWrite={canWrite} />
      )}
    </ErrorBoundary>
  );
}
