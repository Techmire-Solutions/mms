import type { ComponentType } from "react";

export type ExaminationsHostHook = (...args: any[]) => any;

export interface ExaminationsHostValue {
  useAcademicTerms: ExaminationsHostHook;
  useExaminationConfig: ExaminationsHostHook;
  useGenericModuleExport: ExaminationsHostHook;
  useBrandPalette: ExaminationsHostHook;
  useBranding: ExaminationsHostHook;
  useEnrollmentsCollection: ExaminationsHostHook;
  useSessionsCollection: ExaminationsHostHook;
  useStudentsByIds: ExaminationsHostHook;
  useModuleSettingsEditor: ExaminationsHostHook;
  useModulePermissions: ExaminationsHostHook;
  AcademicCatalogSelect: ComponentType<any>;
  KPISummary: ComponentType<any>;
  ModuleReports: ComponentType<any>;
}

let configured: ExaminationsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureExaminationsHost(next: ExaminationsHostValue): void {
  configured = next;
}

/** App-bound examinations host. Module UI never imports `@/…`. */
export function getExaminationsHost(): ExaminationsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Examinations host is not configured (call configureExaminationsHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: ExaminationsHostValue = {
  useAcademicTerms: () => ({ terms: [], activeTerm: null, isLoading: false }),
  useExaminationConfig: () => ({}),
  useGenericModuleExport: () => ({ startExport: allow }),
  useBrandPalette: () => ({ palette: {} }),
  useBranding: () => ({}),
  useEnrollmentsCollection: () => ({ data: [], isLoading: false }),
  useSessionsCollection: () => ({ data: [], isLoading: false }),
  useStudentsByIds: () => ({ byId: new Map(), isLoading: false }),
  useModuleSettingsEditor: () => ({ draft: {}, save: allow, discardDrafts: allow }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  AcademicCatalogSelect: T,
  KPISummary: T,
  ModuleReports: T,
};
