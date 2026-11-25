import React, { lazy } from "react";
import { School } from "lucide-react";
import { ModuleTierPage, type ModuleTierPageSpec } from "../host/ModuleTierPage";
import { useIndustryTerminology } from "../hooks/useIndustryTerminology";
import { FacultyCommandMetrics } from "./FacultyCommandMetrics";
import { FacultyDepartmentsSetupSection } from "./FacultyDepartmentsSetupSection";
import { FacultyDesignationsSetupSection } from "./FacultyDesignationsSetupSection";
import { FacultyPageHeaderActions } from "./FacultyPageHeaderActions";
import { FacultyPageOverlays } from "./FacultyPageOverlays";
import { FacultyWorkTier } from "./FacultyWorkTier";
import type { useFacultyPageController } from "../hooks/useFacultyPageController";

const FacultyReportsTier = lazy(() =>
  import("./FacultyReportsTier").then((m) => ({
    default: m.FacultyReportsTier,
  })),
);
const FacultySetupTier = lazy(() =>
  import("./FacultySetupTier").then((m) => ({
    default: m.FacultySetupTier,
  })),
);

export type FacultyPageViewProps = ReturnType<typeof useFacultyPageController>;

/**
 * Faculty page — faculties, departments, designations, reports, setup.
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
  openCreateDepartment,
  openCreateDesignation,
  onExportEntity,
  onImportEntity,
  tabPanelProps,
  pageOverlaysProps,
}: FacultyPageViewProps): React.JSX.Element {
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
          onAddDepartment={openCreateDepartment}
          onAddDesignation={openCreateDesignation}
        />
      }
      metrics={
        <FacultyCommandMetrics
          total={metricsTotal ?? shownCount}
          // The filtered count belongs to the faculties directory only; showing it
          // on Departments/Designations/Reports/Setup reported the wrong scope.
          shown={activeTab === "faculties" ? shownCount : undefined}
        />
      }
      tiers={[
        { id: "faculties", content: <FacultyWorkTier {...tabPanelProps.workTierProps} /> },
        {
          id: "departments",
          content: <FacultyDepartmentsSetupSection canWrite={canWrite} />,
        },
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
