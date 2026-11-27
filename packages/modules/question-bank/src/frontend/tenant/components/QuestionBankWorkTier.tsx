import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { useTranslation } from "@mms/fe-core/i18n";
import { QuestionBank as QuestionsPanel } from "./QuestionBank";
import type { useQuestionBankColumnLayout } from "../hooks/useQuestionBankColumnLayout";
import type { QuestionBankQuestion, QuestionBankTest } from "@mms/contracts";
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
        tabs={tabs.map((tab: any) => ({ key: tab.id, label: tab.label }))}
        value={activeSubTab}
        onChange={(next: any) => {
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
