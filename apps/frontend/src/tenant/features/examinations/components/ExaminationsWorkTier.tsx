import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { SubTabBar } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import ExaminationsList from "@/tenant/features/examinations/components/ExaminationsList";
import { ResultsView } from "@/tenant/features/examinations/components/ResultsView";
import type { useExaminationExamColumnLayout } from "@/tenant/features/examinations/hooks/useExaminationExamColumnLayout";
import type { useExaminationResultsColumnLayout } from "@/tenant/features/examinations/hooks/useExaminationResultsColumnLayout";
import type { Exam, ExamResult } from "@/lib/data/examinationData";

export interface ExaminationsWorkTab {
  id: string;
  label: string;
}

export type WorkTab = ExaminationsWorkTab;

export interface ExaminationsWorkTierProps {
  tabs: ExaminationsWorkTab[];
  activeSubTab: string;
  showDeleted: boolean;
  listLoadFailed: boolean;
  canWrite: boolean;
  canDelete: boolean;
  createExamKey: number;
  exams: Exam[];
  examResults: ExamResult[];
  examColumnLayout: ReturnType<typeof useExaminationExamColumnLayout>;
  resultsColumnLayout: ReturnType<typeof useExaminationResultsColumnLayout>;
  onSubTabChange: (tab: string) => void;
  onToggleDeleted: () => void;
  onRetry: () => void;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkRestore: (ids: string[]) => Promise<void>;
  onNew: () => void;
  onEdit: (exam: Exam) => void;
  onFilteredCountChange: (count: number) => void;
  onRowClick?: (id: string) => void;
}

export function ExaminationsWorkTier({
  tabs,
  activeSubTab,
  showDeleted,
  listLoadFailed,
  canWrite,
  canDelete,
  createExamKey,
  exams,
  examResults,
  examColumnLayout,
  resultsColumnLayout,
  onSubTabChange,
  onToggleDeleted,
  onRetry,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onNew,
  onEdit,
  onFilteredCountChange,
  onRowClick,
}: ExaminationsWorkTierProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ErrorBoundary>
      <SubTabBar
        tabs={tabs.map((tab) => ({ key: tab.id, label: tab.label }))}
        value={activeSubTab}
        onChange={(next) => {
          onSubTabChange(next);
          if (next !== "exams" && showDeleted) onToggleDeleted();
        }}
      />

      {listLoadFailed ? (
        <ErrorState
          title={t("examinations.loadFailed")}
          description={t("examinations.loadFailedHint")}
          onRetry={onRetry}
        />
      ) : (
        <>
          {activeSubTab === "exams" && (
            <ExaminationsList
              canWrite={canWrite}
              canDelete={canDelete}
              showDeleted={showDeleted}
              onToggleDeleted={onToggleDeleted}
              createRequestKey={createExamKey}
              onDelete={onDelete}
              onRestore={onRestore}
              onBulkDelete={onBulkDelete}
              onBulkRestore={onBulkRestore}
              onNew={onNew}
              onEdit={onEdit}
              onFilteredCountChange={onFilteredCountChange}
              isColumnVisible={examColumnLayout.isColumnVisible}
              getColumnWidth={examColumnLayout.getColumnWidth}
              onColumnResize={examColumnLayout.setColumnWidth}
              onRowClick={onRowClick}
              columnCustomizer={{
                columnRegistry: examColumnLayout.columnRegistry,
                updateUserColumnLayout: examColumnLayout.updateUserColumnLayout,
                onResetLayout: examColumnLayout.resetColumnLayout,
                labels: examColumnLayout.customizerLabels,
              }}
            />
          )}
          {activeSubTab === "results" && (
            <ResultsView
              exams={exams}
              results={examResults}
              onFilteredCountChange={onFilteredCountChange}
              isColumnVisible={resultsColumnLayout.isColumnVisible}
              columnCustomizer={{
                columnRegistry: resultsColumnLayout.columnRegistry,
                updateUserColumnLayout: resultsColumnLayout.updateUserColumnLayout,
                onResetLayout: resultsColumnLayout.resetColumnLayout,
                labels: resultsColumnLayout.customizerLabels,
              }}
            />
          )}
        </>
      )}
    </ErrorBoundary>
  );
}
