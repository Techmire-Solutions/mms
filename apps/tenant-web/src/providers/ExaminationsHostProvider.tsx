import React from "react";
import { configureExaminationsHost } from "@mms/mod-examinations/frontend/tenant/host";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useExaminationConfig } from "@/hooks/useStandardModuleConfig";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { AcademicCatalogSelect } from "@/components/common/catalog/AcademicCatalogSelect";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";

/** Binds the app academic term/config hooks, collections and report shells into the examinations host. */
export function ExaminationsHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureExaminationsHost({
    useAcademicTerms,
    useExaminationConfig,
    useGenericModuleExport,
    useBrandPalette,
    useBranding,
    useEnrollmentsCollection,
    useSessionsCollection,
    useStudentsByIds,
    useModuleSettingsEditor,
    useModulePermissions,
    AcademicCatalogSelect: AcademicCatalogSelect as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    KPISummary: KPISummary as unknown as React.ComponentType<Record<string, unknown>>,
    ModuleReports: ModuleReports as unknown as React.ComponentType<Record<string, unknown>>,
  });
  return <>{children}</>;
}
