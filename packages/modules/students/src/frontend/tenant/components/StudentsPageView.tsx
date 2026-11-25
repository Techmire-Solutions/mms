import React, { lazy, useState } from "react";
import { GraduationCap } from "lucide-react";
import { ModuleTierPage, type ModuleTierPageSpec } from "../host/ModuleTierPage";
import { StudentsCommandMetrics } from "./StudentsCommandMetrics";
import { StudentsPageHeaderActions } from "./StudentsPageHeaderActions";
import { StudentsPageOverlays } from "./StudentsPageOverlays";
import { StudentsWorkTier } from "./StudentsWorkTier";
import type { useStudentsPageController } from "../hooks/useStudentsPageController";

const StudentsSetupTier = lazy(() => import("./StudentsSetupTier"));
const StudentsReportsTier = lazy(() =>
  import("../host/ModuleReportsTier.js").then((m) => ({ default: m.ModuleReportsTier })),
);

const STUDENTS_PAGE_SPEC: ModuleTierPageSpec = {
  seoTitleKey: "page.students.seoTitle",
  subtitleKey: "page.students.subtitle",
  headerTitleKey: "nav.students",
  headerIcon: GraduationCap,
  panelIdPrefix: "students-tab",
};

export type StudentsPageViewProps = ReturnType<typeof useStudentsPageController>;

/** Presentational Students page shell — Work / Reports / Setup + create form. */
export function StudentsPageView({
  canWrite,
  canExport,
  visibleTabs,
  metricsTotal,
  metricsSnapshot,
  metricsLoading,
  metricsError,
  metricsRetry,
  activeTab,
  setActiveTab,
  viewingDeleted,
  shownCount,
  openCreateForm,
  handleExportCSV,
  tabPanelProps,
  pageOverlaysProps,
}: StudentsPageViewProps): React.JSX.Element {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <ModuleTierPage
      spec={STUDENTS_PAGE_SPEC}
      tabs={visibleTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
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
      metrics={
        <StudentsCommandMetrics
          total={metricsTotal ?? shownCount}
          shown={shownCount}
          serverMetrics={metricsSnapshot}
          isLoading={metricsLoading}
          isError={metricsError}
          onRetry={metricsRetry}
        />
      }
      tiers={[
        { id: "work", content: <StudentsWorkTier {...tabPanelProps.workTierProps} /> },
        { id: "reports", content: <StudentsReportsTier category="students" />, lazy: true },
        { id: "setup", content: <StudentsSetupTier />, lazy: true },
      ]}
      overlays={
        <StudentsPageOverlays
          {...pageOverlaysProps}
          importOpen={importOpen}
          onCloseImport={() => setImportOpen(false)}
        />
      }
    />
  );
}
