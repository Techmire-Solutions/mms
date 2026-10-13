import React, { Suspense, lazy, useState } from "react";
import { GraduationCap } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import { StudentsCommandMetrics } from "@/tenant/features/students/components/StudentsCommandMetrics";
import { StudentsPageHeaderActions } from "@/tenant/features/students/components/StudentsPageHeaderActions";
import { StudentsPageOverlays } from "@/tenant/features/students/components/StudentsPageOverlays";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { StudentsWorkTier } from "@/tenant/features/students/components/StudentsWorkTier";
import { useTranslation } from "@/hooks/useTranslation";
import type { useStudentsPageController } from "@/tenant/features/students/hooks/useStudentsPageController";

const StudentsReportsTier = lazy(() =>
  import("@/tenant/features/students/components/StudentsReportsTier").then((m) => ({
    default: m.StudentsReportsTier,
  })),
);
const StudentsSetupTier = lazy(
  () => import("@/tenant/features/students/components/StudentsSetupTier"),
);

export type StudentsPageViewProps = ReturnType<typeof useStudentsPageController>;

/** Presentational Students page shell — Work / Reports / Setup + create form. */
export function StudentsPageView({
  canWrite,
  canExport,
  visibleTabs,
  metricsTotal,
  metricsSnapshot,
  activeTab,
  setActiveTab,
  viewingDeleted,
  shownCount,
  openCreateForm,
  handleExportCSV,
  tabPanelProps,
  pageOverlaysProps,
}: StudentsPageViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <ModulePageShell
      seoTitle={t("page.students.seoTitle")}
      seoDescription={t("page.students.subtitle")}
      headerIcon={GraduationCap}
      headerTitle={t("nav.students")}
      headerSubtitle={t("page.students.subtitle")}
      headerActions={
        <StudentsPageHeaderActions
          canExport={canExport}
          canWrite={canWrite}
          viewingDeleted={viewingDeleted}
          onExport={() => {
            void handleExportCSV();
          }}
          onImport={() => setImportOpen(true)}
          onAddStudent={openCreateForm}
        />
      }
      metricsStrip={
        <StudentsCommandMetrics
          total={metricsTotal ?? shownCount}
          shown={shownCount}
          serverMetrics={metricsSnapshot}
        />
      }
    >
      <ResponsiveAccordionTabs
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panelIdPrefix="students-tab"
      >
        <AnimatePresence mode="wait">
          {activeTab === "work" ? (
            <div className="space-y-5">
              <StudentsWorkTier {...tabPanelProps.workTierProps} />
            </div>
          ) : activeTab === "reports" ? (
            <ErrorBoundary>
              <Suspense fallback={<RouteStatusFallback />}>
                <StudentsReportsTier />
              </Suspense>
            </ErrorBoundary>
          ) : activeTab === "setup" ? (
            <ErrorBoundary>
              <Suspense fallback={<RouteStatusFallback />}>
                <StudentsSetupTier />
              </Suspense>
            </ErrorBoundary>
          ) : null}
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <StudentsPageOverlays
        {...pageOverlaysProps}
        importOpen={importOpen}
        onCloseImport={() => setImportOpen(false)}
      />
    </ModulePageShell>
  );
}
