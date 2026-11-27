import type { ComponentType } from "react";

export type WorkshopsHostHook = (...args: any[]) => any;

export interface WorkshopsHostValue {
  usePermissions: WorkshopsHostHook;
  useModulePermissions: WorkshopsHostHook;
  useCurrency: WorkshopsHostHook;
  useGenericModuleExport: WorkshopsHostHook;
  workshopsCollection: Record<string, WorkshopsHostHook>;
  TemplateDocumentPreview: ComponentType<any>;
  ContactPicker: ComponentType<any>;
  printTemplateDocument: WorkshopsHostHook;
  printHtmlDocument: WorkshopsHostHook;
  printBrandingTokens: Record<string, string>;
}

let configured: WorkshopsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureWorkshopsHost(next: WorkshopsHostValue): void {
  configured = next;
}

/** App-bound workshops host. Module UI never imports `@/…`. */
export function getWorkshopsHost(): WorkshopsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Workshops host is not configured (call configureWorkshopsHost)");
}

const T = () => null;
const allow = () => true;
const noop = () => undefined;
const TEST_HOST: WorkshopsHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useGenericModuleExport: () => ({ startExport: allow }),
  workshopsCollection: {},
  TemplateDocumentPreview: T,
  ContactPicker: T,
  printTemplateDocument: noop,
  printHtmlDocument: noop,
  printBrandingTokens: {},
};
