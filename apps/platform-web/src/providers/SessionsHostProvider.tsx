import React from "react";
import {
  configureSessionsHost,
  type SessionsHostHook,
} from "@mms/mod-sessions/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useSessionConfig } from "@/hooks/useStandardModuleConfig";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useModuleTierPageNav } from "@/tenant/hooks/useModuleTierPageNav";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import {
  useAcademicCatalogActions,
  useAcademicCatalogItems,
  useExaminationSubjects,
} from "@/hooks/useAcademicCatalog";
import { useWorkspaceToday } from "@/hooks/useWorkspaceToday";
import { useCurrency, useFinanceCurrency } from "@/hooks/useCurrency";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import * as enrollments from "@/tenant/hooks/collections/enrollments";
import { invalidateSessionsQueries } from "@mms/mod-sessions/frontend/tenant/hooks/invalidateSessionsQueries";
import { invalidateStudentsQueries } from "@mms/mod-students/frontend/tenant/hooks/invalidateStudentsQueries";
import { invalidateFinanceQueries } from "@mms/mod-billing/frontend/tenant/hooks/invalidateFinanceQueries";
import { ENROLLMENT_PLACEMENTS_QUERY_KEY } from "@/lib/query/enrollmentOperationsQueries";
import * as faculty from "@/tenant/hooks/collections/faculty";
import * as facultyAssignment from "@/lib/faculty/facultyAssignment";
import * as brandingPalette from "@/lib/contexts/BrandingPaletteContext";
import { printHtmlDocument } from "@/lib/ui/printHtmlDocument";
import { genderStatusBadgeConfig } from "@/lib/ui/genderStatusBadge";
import { completionCertificateHtml } from "@/lib/ui/completionCertificateHtml";
import TenantMessageComposerLauncher from "@/tenant/components/messaging/TenantMessageComposerLauncher";
import { NotifyGuardiansButton } from "@/tenant/components/messaging/NotifyGuardiansButton";
import { ModuleTierPage } from "@/components/app/ModuleTierPage";
import { ModuleReportsTier } from "@/tenant/components/moduleReports";

/** Binds the app's RBAC, catalog, branding, collections and overlays into the sessions module host. */
export function SessionsHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  configureSessionsHost({
    usePermissions,
    useModulePermissions,
    useSessionConfig,
    useBranding,
    useModuleSettingsEditor,
    useModuleTierPageNav,
    useAcademicTerms,
    useAcademicCatalogActions,
    useAcademicCatalogItems,
    useExaminationSubjects,
    useWorkspaceToday,
    useCurrency,
    useFinanceCurrency,
    useMessageComposerState,
    useGlobalSettings,
    enrollmentsCollection: enrollments as unknown as Record<string, SessionsHostHook>,
    facultyCollection: faculty as unknown as Record<string, SessionsHostHook>,
    facultyAssignment: facultyAssignment as unknown as Record<string, unknown>,
    invalidation: {
      invalidateEnrollmentsQueries: (enrollments as unknown as Record<string, SessionsHostHook>)
        .invalidateEnrollmentsQueries,
      invalidateSessionsQueries,
      invalidateStudentsQueries,
      invalidateFinanceQueries,
      ENROLLMENT_PLACEMENTS_QUERY_KEY,
    },
    printHtmlDocument,
    genderStatusBadgeConfig,
    completionCertificateHtml,
    BrandingPaletteContext: brandingPalette as unknown as Record<string, unknown>,
    TenantMessageComposerLauncher: TenantMessageComposerLauncher,
    NotifyGuardiansButton: NotifyGuardiansButton,
    ModuleTierPage: ModuleTierPage,
    ModuleReportsTier: ModuleReportsTier,
  });
  return <>{children}</>;
}
