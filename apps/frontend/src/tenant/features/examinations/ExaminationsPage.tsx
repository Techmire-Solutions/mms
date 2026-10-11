import React from "react";
import { AnimatePresence } from "framer-motion";
import { Layers } from "lucide-react";
import { ModulePageShell } from "@/components/ui/ModulePageShell";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/ui/ResponsiveAccordionTabs";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { examinationsTransferSchema } from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { ExaminationsCommandMetrics } from "@/tenant/features/examinations/components/ExaminationsCommandMetrics";
import { ExaminationsModalLayer } from "@/tenant/features/examinations/components/ExaminationsModalLayer";
import { ExaminationsPageActions } from "@/tenant/features/examinations/components/ExaminationsPageActions";
import { ExaminationsWorkTier } from "@/tenant/features/examinations/components/ExaminationsWorkTier";
import { ExaminationsCsvImportDialog } from "@/tenant/features/examinations/components/ExaminationsCsvImportDialog";
import { useExaminationsPageController } from "@/tenant/features/examinations/hooks/useExaminationsPageController";

const ExaminationDetail = React.lazy(() =>
  import("@/tenant/features/examinations/components/ExaminationDetail").then((m) => ({
    default: m.ExaminationDetail,
  })),
);

const ExaminationsReportsTier = React.lazy(() =>
  import("@/tenant/features/examinations/components/ExaminationsReportsTier").then((m) => ({
    default: m.ExaminationsReportsTier,
  })),
);
const ExaminationsSetupTier = React.lazy(() =>
  import("@/tenant/features/examinations/components/ExaminationsSetupTier").then((m) => ({
    default: m.ExaminationsSetupTier,
  })),
);

/**
 * Examinations — formal exams, marking, and results. Work | Reports | Setup.
 */
export default function Examinations(): React.JSX.Element {
  const c = useExaminationsPageController();
  const [importOpen, setImportOpen] = React.useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/examinations/export/csv",
    filename: "examinations.csv",
    auditPath: "/api/examinations/export-audit",
    columns: examinationsTransferSchema.exportColumns,
    canExport: c.canWrite,
  });

  return (
    <ModulePageShell
      seoTitle={`MMS - ${c.t("nav.examinations")}`}
      seoDescription={c.t("page.examinations.subtitle")}
      headerIcon={Layers}
      headerTitle={c.t("nav.examinations")}
      headerSubtitle={c.t("page.examinations.subtitle")}
      headerActions={
        <ExaminationsPageActions
          canWrite={c.canWrite}
          canExport={c.canWrite}
          isExporting={isExporting}
          showDeleted={c.showDeleted}
          onEnterMarks={() => c.setShowMarksModal(true)}
          onCreateExam={c.openCreateExam}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={<ExaminationsCommandMetrics total={c.exams.length} shown={c.filteredCount} />}
    >
      <ResponsiveAccordionTabs
        tabs={c.PAGE_TABS}
        activeTab={c.effectiveTab}
        onTabChange={c.setActiveTab}
        panelIdPrefix="examinations-tab"
      >
        <AnimatePresence mode="wait">
          <ModuleTierMotion
            tier={`${c.effectiveTab}-${c.effectiveSubTab}-${String(c.showDeleted)}`}
            className="space-y-4"
          >
            {c.effectiveTab === "setup" && (
              <React.Suspense fallback={<RouteStatusFallback />}>
                <ExaminationsSetupTier />
              </React.Suspense>
            )}

            {c.effectiveTab === "reports" && (
              <React.Suspense fallback={<RouteStatusFallback />}>
                <ExaminationsReportsTier />
              </React.Suspense>
            )}

            {c.effectiveTab === "work" && (
              <div className="space-y-5">
                <ExaminationsWorkTier
                  tabs={c.OPS_SUB_TABS}
                  activeSubTab={c.effectiveSubTab}
                  showDeleted={c.showDeleted}
                  listLoadFailed={c.listLoadFailed}
                  canWrite={c.canWrite}
                  canDelete={c.canDelete}
                  createExamKey={c.createExamKey}
                  exams={c.exams}
                  examResults={c.examResults}
                  examColumnLayout={c.examColumnLayout}
                  resultsColumnLayout={c.resultsColumnLayout}
                  onSubTabChange={c.setActiveSubTab}
                  onToggleDeleted={() => c.setShowDeleted((prev) => !prev)}
                  onRetry={c.refetchExams}
                  onDelete={c.handleDeleteExam}
                  onRestore={c.handleRestoreExam}
                  onBulkDelete={c.handleBulkDelete}
                  onBulkRestore={c.handleBulkRestore}
                  onNew={() => {
                    c.setEditExam(null);
                    c.setShowExamForm(true);
                  }}
                  onEdit={(exam) => {
                    c.setEditExam(exam);
                    c.setShowExamForm(true);
                  }}
                  onFilteredCountChange={c.setFilteredCount}
                  onRowClick={(id) => {
                    const e = c.exams.find((ex) => ex.id === id);
                    if (e) c.setActiveExam(e);
                  }}
                />
              </div>
            )}
          </ModuleTierMotion>
        </AnimatePresence>

        <AnimatePresence>
          {c.activeExam && (
            <React.Suspense fallback={null}>
              <ExaminationDetail
                exam={c.activeExam}
                onClose={() => c.setActiveExam(null)}
                onEdit={(exam) => {
                  c.setActiveExam(null);
                  c.setEditExam(exam);
                  c.setShowExamForm(true);
                }}
                canDelete={c.canDelete}
                onRestore={c.handleRestoreExam}
              />
            </React.Suspense>
          )}
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <ExaminationsModalLayer
        canWrite={c.canWrite}
        showDeleted={c.showDeleted}
        showExamForm={c.showExamForm}
        showMarksModal={c.showMarksModal}
        editExam={c.editExam}
        exams={c.exams}
        examResults={c.examResults}
        onCloseExamForm={() => {
          c.setShowExamForm(false);
          c.setEditExam(null);
        }}
        onSaveExam={c.handleSaveExam}
        onCloseMarks={() => c.setShowMarksModal(false)}
        onSaveResults={c.handleSaveResults}
      />

      <ExaminationsCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={c.canWrite}
      />
    </ModulePageShell>
  );
}
