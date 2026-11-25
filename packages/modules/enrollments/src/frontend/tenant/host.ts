import React, { type ComponentType } from "react";

export type EnrollmentsHostHook = (...args: any[]) => any;

export interface EnrollmentsHostValue {
  usePermissions: EnrollmentsHostHook;
  useModulePermissions: EnrollmentsHostHook;
  useViewerRole: EnrollmentsHostHook;
  useEnrollmentConfig: EnrollmentsHostHook;
  useAcademicTerms: EnrollmentsHostHook;
  useCurrency: EnrollmentsHostHook;
  useFinanceCurrency: EnrollmentsHostHook;
  useModuleSettingsEditor: EnrollmentsHostHook;
  useWorkDrillDownListener: EnrollmentsHostHook;
  useMessageComposerState: EnrollmentsHostHook;
  sessionsCollection: Record<string, EnrollmentsHostHook>;
  studentsCollection: Record<string, EnrollmentsHostHook>;
  examinationsCollection: Record<string, EnrollmentsHostHook>;
  enrollmentImpactInvalidation: Record<string, unknown>;
  registrationQueries: Record<string, unknown>;
  enrollmentOperationsQueries: Record<string, unknown>;
  sessionsData: Record<string, unknown>;
  studentsData: Record<string, unknown>;
  studentStatusUi: Record<string, unknown>;
  genderStatusBadge: any;
  radioGroupKeyboard: Record<string, unknown>;
  enrollmentStatusBadge: Record<string, unknown>;
  printBrandingTokens: Record<string, unknown>;
  printHtmlDocument: EnrollmentsHostHook;
  completionCertificateHtml: EnrollmentsHostHook;
  BrandingPaletteContext: Record<string, unknown>;
  RegistryPersonSelect: ComponentType<any>;
  NotifyGuardiansButton: ComponentType<any>;
  TenantMessageComposer: ComponentType<any>;
  ModuleReportsTier: ComponentType<any>;
  ReportDataGridContainer: ComponentType<any>;
  ReportChartCard: ComponentType<any>;
  PinnedWidgets: ComponentType<any>;
  ReportFilterBanner: ComponentType<any>;
  SessionClassSectionSelect: ComponentType<any>;
  WorkListFiltersScaffold: ComponentType<any>;
}

let configured: EnrollmentsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureEnrollmentsHost(next: EnrollmentsHostValue): void {
  configured = next;
}

/** App-bound enrollments host. Module UI never imports `@/…`. */
export function getEnrollmentsHost(): EnrollmentsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Enrollments host is not configured (call configureEnrollmentsHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: EnrollmentsHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useViewerRole: () => ({ role: "admin" }),
  useEnrollmentConfig: () => ({}),
  useAcademicTerms: () => ({ terms: [] }),
  useCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useFinanceCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useModuleSettingsEditor: () => ({
    draft: {},
    setDraft: allow,
    save: allow,
    discardDrafts: allow,
  }),
  useWorkDrillDownListener: () => undefined,
  useMessageComposerState: () => ({}),
  sessionsCollection: {},
  studentsCollection: {},
  examinationsCollection: {},
  enrollmentImpactInvalidation: {},
  registrationQueries: {},
  enrollmentOperationsQueries: {},
  sessionsData: {},
  studentsData: {},
  studentStatusUi: {},
  genderStatusBadge: () => "",
  radioGroupKeyboard: {},
  enrollmentStatusBadge: {},
  printBrandingTokens: {},
  printHtmlDocument: () => "",
  completionCertificateHtml: () => "",
  BrandingPaletteContext: {},
  RegistryPersonSelect: T,
  NotifyGuardiansButton: T,
  TenantMessageComposer: T,
  ModuleReportsTier: T,
  ReportDataGridContainer: ({
    title,
    children,
  }: {
    title?: React.ReactNode;
    children?: React.ReactNode;
  }) => React.createElement("div", null, title, children),
  ReportChartCard: ({
    title,
    empty,
    emptyNode,
    children,
  }: {
    title?: React.ReactNode;
    empty?: boolean;
    emptyNode?: React.ReactNode;
    children?: React.ReactNode;
  }) => React.createElement("div", null, title, empty && emptyNode ? emptyNode : children),
  PinnedWidgets: T,
  ReportFilterBanner: T,
  SessionClassSectionSelect: T,
  WorkListFiltersScaffold: T,
};
