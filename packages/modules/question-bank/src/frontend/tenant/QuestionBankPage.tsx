import React, { type JSX, Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import { Library } from "lucide-react";
import { ModulePageShell } from "@mms/fe-core/components/ModulePageShell";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@mms/fe-core/components/ResponsiveAccordionTabs";
import RouteStatusFallback from "@mms/fe-core/routing/RouteStatusFallback";
import { questionBankTransferSchema } from "@mms/contracts";
import { useGenericModuleExport } from "./host/useGenericModuleExport";
import { QuestionBankCommandMetrics } from "./components/QuestionBankCommandMetrics";
import { QuestionBankModalLayer } from "./components/QuestionBankModalLayer";
import { QuestionBankPageActions } from "./components/QuestionBankPageActions";
import { QuestionBankCsvImportDialog } from "./components/QuestionBankCsvImportDialog";
import { QuestionBankWorkTier } from "./components/QuestionBankWorkTier";
import { QuestionBankDetail } from "./components/QuestionBankDetail";
import { useQuestionBankPageController } from "./hooks/useQuestionBankPageController";

const QuestionBankReportsTier: React.ComponentType<any> = lazy(() =>
  import("./host/ReportChartCard").then((m: any) => ({ default: m.ReportChartCard })),
);
const QuestionBankSetupTier: React.ComponentType<any> = lazy(() =>
  import("./components/QuestionBankSetupTier").then((m: any) => ({
    default: m.QuestionBankSetupTier,
  })),
);

/**
 * Question Bank — Work | Reports | Setup.
 */
export default function QuestionBankPage(): JSX.Element {
  const c = useQuestionBankPageController();
  const [importOpen, setImportOpen] = React.useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/question-bank/export/csv",
    filename: "question-bank.csv",
    auditPath: "/api/question-bank/export-audit",
    columns: questionBankTransferSchema.exportColumns,
    canExport: c.canWrite,
  });

  return (
    <ModulePageShell
      seoTitle={`MMS - ${c.t("page.questionBank.title")}`}
      seoDescription={c.t("page.questionBank.subtitle")}
      headerIcon={Library}
      headerTitle={c.t("nav.questionBank")}
      headerSubtitle={c.t("page.questionBank.subtitle")}
      headerActions={
        <QuestionBankPageActions
          canWrite={c.canWrite}
          canExport={c.canWrite}
          isExporting={isExporting}
          showDeleted={c.showDeleted}
          onCreatePaper={c.openCreatePaper}
          onAddQuestion={c.openAddQuestion}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={
        <QuestionBankCommandMetrics total={c.questions.length} shown={c.filteredCount} />
      }
    >
      <ResponsiveAccordionTabs
        tabs={c.PAGE_TABS}
        activeTab={c.effectiveTab}
        onTabChange={c.setActiveTab}
        panelIdPrefix="question-bank-tab"
      >
        <AnimatePresence mode="wait">
          <ModuleTierMotion
            tier={`${c.effectiveTab}-${c.effectiveSubTab}-${String(c.showDeleted)}`}
            className="space-y-4"
          >
            {c.effectiveTab === "setup" && (
              <Suspense fallback={<RouteStatusFallback />}>
                <QuestionBankSetupTier />
              </Suspense>
            )}

            {c.effectiveTab === "reports" && (
              <Suspense fallback={<RouteStatusFallback />}>
                <QuestionBankReportsTier category="questionBank" />
              </Suspense>
            )}

            {c.effectiveTab === "work" && (
              <div className="space-y-5">
                <QuestionBankWorkTier
                  tabs={c.OPS_SUB_TABS}
                  activeSubTab={c.effectiveSubTab}
                  showDeleted={c.showDeleted}
                  listLoadFailed={c.listLoadFailed}
                  questions={c.questions}
                  tests={c.tests}
                  showQuestionModal={c.showQuestionModal}
                  editQuestion={c.editQuestion}
                  canWrite={c.canWrite}
                  canDelete={c.canDelete}
                  columnLayout={c.columnLayout}
                  onSubTabChange={c.setActiveSubTab}
                  onToggleDeleted={() => c.setShowDeleted((prev: any) => !prev)}
                  onRetry={c.refetchQuestions}
                  onUpdateQuestions={c.setQuestions}
                  onQuestionModalOpenChange={c.setShowQuestionModal}
                  onEditQuestionChange={c.setEditQuestion}
                  onDelete={c.handleDeleteQuestion}
                  onRestore={c.handleRestoreQuestion}
                  onBulkDelete={c.handleBulkDelete}
                  onBulkRestore={c.handleBulkRestore}
                  onFilteredCountChange={c.setFilteredCount}
                  selectedIds={c.questionSelection.selectedIds}
                  onToggleSelectedQuestion={c.questionSelection.toggleSelected}
                  onToggleSelectAll={c.questionSelection.toggleSelectAll}
                  onClearSelection={c.questionSelection.clearSelection}
                  onRowClick={(id: any) => {
                    const q = c.questions.find((q: any) => q.id === id);
                    if (q) c.setActiveQuestion(q);
                  }}
                />
              </div>
            )}
          </ModuleTierMotion>
        </AnimatePresence>

        <AnimatePresence>
          {c.activeQuestion && (
            <QuestionBankDetail
              question={c.activeQuestion}
              config={c.questionBankConfig}
              onClose={() => c.setActiveQuestion(null)}
              onEdit={(q: any) => {
                c.setActiveQuestion(null);
                c.setEditQuestion(q);
                c.setShowQuestionModal(true);
              }}
              canDelete={c.canDelete}
              canWrite={c.canWrite}
              canApprove={c.canDelete}
              onRestore={c.handleRestoreQuestion}
              onSetStatus={c.handleSetQuestionStatus}
              onDuplicate={c.handleDuplicateQuestion}
            />
          )}
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <QuestionBankModalLayer
        canWrite={c.canWrite}
        showDeleted={c.showDeleted}
        paperBuilderOpen={c.paperBuilderOpen}
        paperBuilderSession={c.paperBuilderSession}
        paperBuilderTab={c.paperBuilderTab}
        questions={c.questions}
        tests={c.tests}
        showQuestionModal={c.showQuestionModal}
        editQuestion={c.editQuestion}
        onClosePaperBuilder={() => c.setPaperBuilderOpen(false)}
        onPaperBuilderTabChange={c.setPaperBuilderTab}
        onSaveTest={c.handleSaveTest}
        onCloseQuestion={c.closeQuestionModal}
        onSaveQuestion={c.handleQuestionSave}
      />
      <QuestionBankCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={c.canWrite}
      />
    </ModulePageShell>
  );
}
