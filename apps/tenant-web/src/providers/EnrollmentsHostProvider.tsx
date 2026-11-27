import React from "react";
import {
  configureEnrollmentsHost,
  type EnrollmentsHostHook,
  type EnrollmentsHostValue,
} from "@mms/mod-enrollments/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useViewerRole } from "@/tenant/hooks/useViewerRole";
import { useEnrollmentConfig } from "@/hooks/useStandardModuleConfig";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useCurrency, useFinanceCurrency } from "@/hooks/useCurrency";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useWorkDrillDownListener } from "@/lib/query/useWorkDrillDownListener";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import * as sessions from "@/tenant/hooks/collections/sessions";
import * as students from "@/tenant/hooks/collections/students";
import * as examinations from "@/tenant/hooks/collections/examinations";
import * as enrollmentImpactInvalidation from "@/lib/query/enrollmentImpactInvalidation";
import * as registrationQueries from "@/lib/query/registrationQueries";
import * as enrollmentOperationsQueries from "@/lib/query/enrollmentOperationsQueries";
import * as sessionsData from "@/lib/data/sessionsData";
import * as studentsData from "@/lib/data/studentsData";
import * as studentStatusUi from "@/lib/students/studentStatusUi";
import * as genderStatusBadge from "@/lib/ui/genderStatusBadge";
import * as radioGroupKeyboard from "@/lib/ui/radioGroupKeyboard";
import * as enrollmentStatusBadge from "@/lib/ui/enrollmentStatusBadge";
import * as printBrandingTokens from "@/lib/ui/printBrandingTokens";
import * as BrandingPaletteContext from "@/lib/contexts/BrandingPaletteContext";
import { printHtmlDocument } from "@/lib/ui/printHtmlDocument";
import { completionCertificateHtml } from "@/lib/ui/completionCertificateHtml";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import { NotifyGuardiansButton } from "@/tenant/components/messaging/NotifyGuardiansButton";
import TenantMessageComposer from "@/tenant/components/messaging/TenantMessageComposer";
import {
  ModuleReportsTier,
  ReportChartCard,
  ReportDataGridContainer,
} from "@/tenant/components/moduleReports";
import PinnedWidgets from "@mms/mod-analytics/frontend/tenant/features/components/PinnedWidgets";
import { ReportFilterBanner } from "@mms/mod-analytics/frontend/tenant/components/ReportFilterBanner";
import { SessionClassSectionSelect } from "@/components/common/SessionClassSectionSelect";
import { WorkListFiltersScaffold } from "@/components/common";

/** Binds the app's RBAC, config, collections, reports and overlays into the enrollments module host. */
export function EnrollmentsHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureEnrollmentsHost({
    usePermissions,
    useModulePermissions,
    useViewerRole,
    useEnrollmentConfig,
    useAcademicTerms,
    useCurrency,
    useFinanceCurrency,
    useModuleSettingsEditor,
    useWorkDrillDownListener,
    useMessageComposerState,
    sessionsCollection: sessions as unknown as Record<string, EnrollmentsHostHook>,
    studentsCollection: students as unknown as Record<string, EnrollmentsHostHook>,
    examinationsCollection: examinations as unknown as Record<string, EnrollmentsHostHook>,
    enrollmentImpactInvalidation: enrollmentImpactInvalidation as unknown as Record<
      string,
      unknown
    >,
    registrationQueries: registrationQueries as unknown as Record<string, unknown>,
    enrollmentOperationsQueries: enrollmentOperationsQueries as unknown as Record<string, unknown>,
    sessionsData: sessionsData as unknown as Record<string, unknown>,
    studentsData: studentsData as unknown as Record<string, unknown>,
    studentStatusUi: studentStatusUi as unknown as Record<string, unknown>,
    genderStatusBadge: (genderStatusBadge as Record<string, unknown>)
      .genderStatusBadgeConfig as EnrollmentsHostValue["genderStatusBadge"],
    radioGroupKeyboard: radioGroupKeyboard as unknown as Record<string, unknown>,
    enrollmentStatusBadge: enrollmentStatusBadge as unknown as Record<string, unknown>,
    printBrandingTokens: printBrandingTokens as unknown as Record<string, unknown>,
    printHtmlDocument,
    completionCertificateHtml,
    BrandingPaletteContext: BrandingPaletteContext as unknown as Record<string, unknown>,
    RegistryPersonSelect:
      RegistryPersonSelect as unknown as EnrollmentsHostValue["RegistryPersonSelect"],
    NotifyGuardiansButton:
      NotifyGuardiansButton as unknown as EnrollmentsHostValue["NotifyGuardiansButton"],
    TenantMessageComposer:
      TenantMessageComposer as unknown as EnrollmentsHostValue["TenantMessageComposer"],
    ModuleReportsTier: ModuleReportsTier as unknown as EnrollmentsHostValue["ModuleReportsTier"],
    ReportChartCard: ReportChartCard as unknown as EnrollmentsHostValue["ReportChartCard"],
    ReportDataGridContainer:
      ReportDataGridContainer as unknown as EnrollmentsHostValue["ReportDataGridContainer"],
    PinnedWidgets: PinnedWidgets as unknown as EnrollmentsHostValue["PinnedWidgets"],
    ReportFilterBanner: ReportFilterBanner as unknown as EnrollmentsHostValue["ReportFilterBanner"],
    SessionClassSectionSelect:
      SessionClassSectionSelect as unknown as EnrollmentsHostValue["SessionClassSectionSelect"],
    WorkListFiltersScaffold:
      WorkListFiltersScaffold as unknown as EnrollmentsHostValue["WorkListFiltersScaffold"],
  });
  return <>{children}</>;
}
