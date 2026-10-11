import React, { type JSX, Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import { Library } from "lucide-react";
import { ModulePageShell } from "@/components/ui/ModulePageShell";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/ui/ResponsiveAccordionTabs";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { questionBankTransferSchema } from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { QuestionBankCommandMetrics } from "@/tenant/features/question-bank/components/QuestionBankCommandMetrics";
import { QuestionBankModalLayer } from "@/tenant/features/question-bank/components/QuestionBankModalLayer";
import { QuestionBankPageActions } from "@/tenant/features/question-bank/components/QuestionBankPageActions";
import { QuestionBankCsvImportDialog } from "@/tenant/features/question-bank/components/QuestionBankCsvImportDialog";
import { QuestionBankWorkTier } from "@/tenant/features/question-bank/components/QuestionBankWorkTier";
import { QuestionBankDetail } from "@/tenant/features/question-bank/components/QuestionBankDetail";
import { useQuestionBankPageController } from "@/tenant/features/question-bank/hooks/useQuestionBankPageController";

const QuestionBankReportsTier = lazy(() =>
  import("@/tenant/features/question-bank/components/QuestionBankReportsTier").then((m) => ({
    default: m.QuestionBankReportsTier,
  })),
);
const QuestionBankSetupTier = lazy(() =>
  import("@/tenant/features/question-bank/components/QuestionBankSetupTier").then((m) => ({
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
                <QuestionBankReportsTier />
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
                  showQuestionModal={c.showQuestionModal}
                  editQuestion={c.editQuestion}
                  canWrite={c.canWrite}
                  canDelete={c.canDelete}
                  columnLayout={c.columnLayout}
                  onSubTabChange={c.setActiveSubTab}
                  onToggleDeleted={() => c.setShowDeleted((prev) => !prev)}
                  onRetry={c.refetchQuestions}
                  onUpdateQuestions={c.setQuestions}
                  onQuestionModalOpenChange={c.setShowQuestionModal}
                  onEditQuestionChange={c.setEditQuestion}
                  onDelete={c.handleDeleteQuestion}
                  onRestore={c.handleRestoreQuestion}
                  onBulkDelete={c.handleBulkDelete}
                  onBulkRestore={c.handleBulkRestore}
                  onFilteredCountChange={c.setFilteredCount}
                  onCreatePaper={c.openCreatePaper}
                  selectedIds={c.questionSelection.selectedIds}
                  onToggleSelectedQuestion={c.questionSelection.toggleSelected}
                  onToggleSelectAll={c.questionSelection.toggleSelectAll}
                  onClearSelection={c.questionSelection.clearSelection}
                  onRowClick={(id) => {
                    const q = c.questions.find((q) => q.id === id);
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
              onEdit={(q) => {
                c.setActiveQuestion(null);
                c.setEditQuestion(q);
                c.setShowQuestionModal(true);
              }}
              canDelete={c.canDelete}
              onRestore={c.handleRestoreQuestion}
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
