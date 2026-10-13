import React, { Suspense, lazy } from "react";
import { School } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import { useTranslation } from "@/hooks/useTranslation";
import { useIndustryTerminology } from "@/tenant/hooks/useIndustryTerminology";
import { FacultyCommandMetrics } from "@/tenant/features/faculty/components/FacultyCommandMetrics";
import { FacultyDesignationsSetupSection } from "@/tenant/features/faculty/components/FacultyDesignationsSetupSection";
import { FacultyPageHeaderActions } from "@/tenant/features/faculty/components/FacultyPageHeaderActions";
import { FacultyPageOverlays } from "@/tenant/features/faculty/components/FacultyPageOverlays";
import { FacultyWorkTier } from "@/tenant/features/faculty/components/FacultyWorkTier";
import { AnimatePresence } from "framer-motion";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import type { useFacultyPageController } from "@/tenant/features/faculty/hooks/useFacultyPageController";
import type { FacultyIoEntity } from "@/tenant/features/faculty/facultyPageWorkSubTabs";

const FacultyReportsTier = lazy(() =>
  import("@/tenant/features/faculty/components/FacultyReportsTier").then((m) => ({
    default: m.FacultyReportsTier,
  })),
);
const FacultySetupTier = lazy(() =>
  import("@/tenant/features/faculty/components/FacultySetupTier").then((m) => ({
    default: m.FacultySetupTier,
  })),
);

export type FacultyPageViewProps = ReturnType<typeof useFacultyPageController>;

function EntityTabPanel({
  children,
}: {
  entity: FacultyIoEntity;
  canWrite: boolean;
  canExport: boolean;
  viewingDeleted: boolean;
  onExportEntity: FacultyPageViewProps["onExportEntity"];
  onImportEntity: FacultyPageViewProps["onImportEntity"];
  onAdd: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="space-y-5">{children}</div>;
}

/**
 * Faculty page — faculties, designations, reports, setup.
 * Departments catalog stays available via designation / form quick-create.
 */
export function FacultyPageView({
  canWrite,
  canExport,
  visibleTabs,
  metricsTotal,
  activeTab,
  setActiveTab,
  viewingDeleted,
  shownCount,
  openCreateForm,
  openCreateDesignation,
  onExportEntity,
  onImportEntity,
  tabPanelProps,
  pageOverlaysProps,
}: FacultyPageViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const terminology = useIndustryTerminology();

  return (
    <ModulePageShell
      seoTitle={t("page.faculty.seoTitle")}
      seoDescription={t("page.faculty.subtitle")}
      headerIcon={School}
      headerTitle={terminology.facultyLabel}
      headerSubtitle={t("page.faculty.subtitle")}
      headerActions={
        <FacultyPageHeaderActions
          canExport={canExport}
          canWrite={canWrite}
          viewingDeleted={viewingDeleted}
          onExportEntity={onExportEntity}
          onImportEntity={onImportEntity}
          onAddFaculty={openCreateForm}
          onAddDesignation={openCreateDesignation}
        />
      }
      metricsStrip={<FacultyCommandMetrics total={metricsTotal ?? shownCount} shown={shownCount} />}
    >
      <ResponsiveAccordionTabs
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panelIdPrefix="faculty-tab"
      >
        <AnimatePresence mode="wait">
          {activeTab === "faculties" ? (
            <EntityTabPanel
              entity="faculties"
              canWrite={canWrite}
              canExport={canExport}
              viewingDeleted={viewingDeleted}
              onExportEntity={onExportEntity}
              onImportEntity={onImportEntity}
              onAdd={openCreateForm}
            >
              <FacultyWorkTier {...tabPanelProps.workTierProps} />
            </EntityTabPanel>
          ) : activeTab === "designations" ? (
            <EntityTabPanel
              entity="designations"
              canWrite={canWrite}
              canExport={canExport}
              viewingDeleted={viewingDeleted}
              onExportEntity={onExportEntity}
              onImportEntity={onImportEntity}
              onAdd={openCreateDesignation}
            >
              <FacultyDesignationsSetupSection canWrite={canWrite} />
            </EntityTabPanel>
          ) : activeTab === "reports" ? (
            <Suspense fallback={<RouteStatusFallback />}>
              <FacultyReportsTier />
            </Suspense>
          ) : activeTab === "setup" ? (
            <Suspense fallback={<RouteStatusFallback />}>
              <FacultySetupTier />
            </Suspense>
          ) : null}
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <FacultyPageOverlays {...pageOverlaysProps} />
    </ModulePageShell>
  );
}

export default FacultyPageView;
