import React, { lazy } from "react";
import { School } from "lucide-react";
import { ModuleTierPage, type ModuleTierPageSpec } from "@/components/app/ModuleTierPage";
import { useTranslation } from "@/hooks/useTranslation";
import { useIndustryTerminology } from "@/tenant/hooks/useIndustryTerminology";
import { FacultyCommandMetrics } from "@/tenant/features/faculty/components/FacultyCommandMetrics";
import { FacultyDesignationsSetupSection } from "@/tenant/features/faculty/components/FacultyDesignationsSetupSection";
import { FacultyPageHeaderActions } from "@/tenant/features/faculty/components/FacultyPageHeaderActions";
import { FacultyPageOverlays } from "@/tenant/features/faculty/components/FacultyPageOverlays";
import { FacultyWorkTier } from "@/tenant/features/faculty/components/FacultyWorkTier";
import type { useFacultyPageController } from "@/tenant/features/faculty/hooks/useFacultyPageController";

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

  const spec: ModuleTierPageSpec = {
    seoTitleKey: "page.faculty.seoTitle",
    subtitleKey: "page.faculty.subtitle",
    headerTitle: terminology.facultyLabel,
    headerIcon: School,
    panelIdPrefix: "faculty-tab",
  };

  return (
    <ModuleTierPage
      spec={spec}
      tabs={visibleTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
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
      metrics={<FacultyCommandMetrics total={metricsTotal ?? shownCount} shown={shownCount} />}
      tiers={[
        { id: "faculties", content: <FacultyWorkTier {...tabPanelProps.workTierProps} /> },
        {
          id: "designations",
          content: <FacultyDesignationsSetupSection canWrite={canWrite} />,
        },
        { id: "reports", content: <FacultyReportsTier />, lazy: true },
        { id: "setup", content: <FacultySetupTier />, lazy: true },
      ]}
      overlays={<FacultyPageOverlays {...pageOverlaysProps} />}
    />
  );
}

export default FacultyPageView;
