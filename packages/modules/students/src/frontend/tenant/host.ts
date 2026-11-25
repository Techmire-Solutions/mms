import type { ComponentType } from "react";

export type StudentsHostHook = (...args: any[]) => any;

export interface StudentsHostValue {
  usePermissions: StudentsHostHook;
  useModulePermissions: StudentsHostHook;
  useStudentConfig: StudentsHostHook;
  useBranding: StudentsHostHook;
  useModuleSettingsEditor: StudentsHostHook;
  useModuleTierPageNav: StudentsHostHook;
  useAcademicTerms: StudentsHostHook;
  useMessageComposerState: StudentsHostHook;
  useCurrency: StudentsHostHook;
  useFinanceCurrency: StudentsHostHook;
  formatLocalizedRelationshipLabel: StudentsHostHook;
  formatLocalizedRelationshipParts: StudentsHostHook;
  useGenericModuleExport: StudentsHostHook;
  useWorkDrillDownListener: StudentsHostHook;
  contactsCollection: Record<string, StudentsHostHook>;
  sessionsCollection: Record<string, StudentsHostHook>;
  enrollmentsCollection: Record<string, StudentsHostHook>;
  invoiceTemplateStore: Record<string, unknown>;
  printBrandingTokens: Record<string, unknown>;
  ContactPicker: ComponentType<any>;
  ContactEditModal: ComponentType<any>;
  ModuleTierPage: ComponentType<any>;
  ModuleReportsTier: ComponentType<any>;
  TenantMessageComposerLauncher: ComponentType<any>;
}

let configured: StudentsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureStudentsHost(next: StudentsHostValue): void {
  configured = next;
}

/** App-bound students host. Module UI never imports `@/…`. */
export function getStudentsHost(): StudentsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Students host is not configured (call configureStudentsHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: StudentsHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useStudentConfig: () => ({}),
  useBranding: () => ({}),
  useModuleSettingsEditor: () => ({
    draft: {},
    setDraft: allow,
    save: allow,
    discardDrafts: allow,
  }),
  useModuleTierPageNav: () => ({}),
  useAcademicTerms: () => ({ terms: [] }),
  useMessageComposerState: () => ({ state: {}, setState: allow }),
  useCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useFinanceCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  formatLocalizedRelationshipLabel: (relationship: string) => relationship ?? "",
  formatLocalizedRelationshipParts: (relationship: string) => ({
    display: relationship ?? "",
    label: relationship ?? "",
  }),
  useGenericModuleExport: () => ({ startExport: allow }),
  useWorkDrillDownListener: () => undefined,
  contactsCollection: {},
  sessionsCollection: {},
  enrollmentsCollection: {},
  invoiceTemplateStore: {},
  printBrandingTokens: {},
  ContactPicker: T,
  ContactEditModal: T,
  ModuleTierPage: T,
  ModuleReportsTier: T,
  TenantMessageComposerLauncher: T,
};
