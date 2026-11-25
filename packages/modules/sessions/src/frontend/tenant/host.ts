import type { ComponentType } from "react";

export type SessionsHostHook = (...args: any[]) => any;

export interface SessionsHostValue {
  usePermissions: SessionsHostHook;
  useModulePermissions: SessionsHostHook;
  useSessionConfig: SessionsHostHook;
  useBranding: SessionsHostHook;
  useModuleSettingsEditor: SessionsHostHook;
  useModuleTierPageNav: SessionsHostHook;
  useAcademicTerms: SessionsHostHook;
  useAcademicCatalogActions: SessionsHostHook;
  useAcademicCatalogItems: SessionsHostHook;
  useExaminationSubjects: SessionsHostHook;
  useWorkspaceToday: SessionsHostHook;
  useCurrency: SessionsHostHook;
  useFinanceCurrency: SessionsHostHook;
  useMessageComposerState: SessionsHostHook;
  useGlobalSettings: SessionsHostHook;
  enrollmentsCollection: Record<string, SessionsHostHook>;
  invalidation: Record<string, any>;
  facultyCollection: Record<string, SessionsHostHook>;
  facultyAssignment: Record<string, unknown>;
  printHtmlDocument: SessionsHostHook;
  genderStatusBadgeConfig: any;
  completionCertificateHtml: SessionsHostHook;
  BrandingPaletteContext: Record<string, unknown>;
  TenantMessageComposerLauncher: ComponentType<any>;
  NotifyGuardiansButton: ComponentType<any>;
  ModuleTierPage: ComponentType<any>;
  ModuleReportsTier: ComponentType<any>;
}

let configured: SessionsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureSessionsHost(next: SessionsHostValue): void {
  configured = next;
}

/** App-bound sessions host. Module UI never imports `@/…`. */
export function getSessionsHost(): SessionsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Sessions host is not configured (call configureSessionsHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: SessionsHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useSessionConfig: () => ({}),
  useBranding: () => ({}),
  useModuleSettingsEditor: () => ({
    draft: {},
    setDraft: allow,
    save: allow,
    discardDrafts: allow,
  }),
  useModuleTierPageNav: () => ({}),
  useAcademicTerms: () => ({ terms: [] }),
  useAcademicCatalogActions: () => ({}),
  useAcademicCatalogItems: () => [],
  useExaminationSubjects: () => [],
  useWorkspaceToday: () => "2026-01-01",
  useCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useFinanceCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useMessageComposerState: () => ({ state: {}, setState: allow }),
  useGlobalSettings: () => ({}),
  enrollmentsCollection: {},
  invalidation: {
    invalidateEnrollmentsQueries: (qc: {
      invalidateQueries: (arg: { queryKey: readonly unknown[] }) => unknown;
    }) => {
      void qc.invalidateQueries({ queryKey: ["enrollments", "list"] });
    },
    invalidateSessionsQueries: (qc: {
      invalidateQueries: (arg: { queryKey: readonly unknown[] }) => unknown;
    }) => {
      void qc.invalidateQueries({ queryKey: ["sessions", "list"] });
    },
    invalidateStudentsQueries: (qc: {
      invalidateQueries: (arg: { queryKey: readonly unknown[] }) => unknown;
    }) => {
      void qc.invalidateQueries({ queryKey: ["students", "list"] });
    },
    invalidateFinanceQueries: (qc: {
      invalidateQueries: (arg: { queryKey: readonly unknown[] }) => unknown;
    }) => {
      void qc.invalidateQueries({ queryKey: ["finance", "invoices"] });
    },
    ENROLLMENT_PLACEMENTS_QUERY_KEY: ["enrollments", "placements"],
  },
  facultyCollection: {},
  facultyAssignment: {},
  printHtmlDocument: () => "",
  genderStatusBadgeConfig: () => ({}),
  completionCertificateHtml: () => "",
  BrandingPaletteContext: {},
  TenantMessageComposerLauncher: T,
  NotifyGuardiansButton: T,
  ModuleTierPage: T,
  ModuleReportsTier: T,
};
