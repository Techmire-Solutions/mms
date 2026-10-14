import React, { lazy, useState } from "react";
import { GraduationCap } from "lucide-react";
import { ModuleTierPage, type ModuleTierPageSpec } from "@/components/app/ModuleTierPage";
import { StudentsCommandMetrics } from "@/tenant/features/students/components/StudentsCommandMetrics";
import { StudentsPageHeaderActions } from "@/tenant/features/students/components/StudentsPageHeaderActions";
import { StudentsPageOverlays } from "@/tenant/features/students/components/StudentsPageOverlays";
import { StudentsWorkTier } from "@/tenant/features/students/components/StudentsWorkTier";
import { useTranslation } from "@/hooks/useTranslation";
import type { useStudentsPageController } from "@/tenant/features/students/hooks/useStudentsPageController";

const StudentsSetupTier = lazy(
  () => import("@/tenant/features/students/components/StudentsSetupTier"),
);
const StudentsReportsTier = lazy(() =>
  import("@/tenant/components/moduleReports").then((m) => ({ default: m.ModuleReportsTier })),
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
