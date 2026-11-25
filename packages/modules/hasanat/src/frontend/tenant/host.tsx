import { createContext, useContext, type ComponentType } from "react";

/** Loose callable shape for host-bound query/hook surfaces. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HasanatHostHook = (...args: any[]) => any;

export interface HasanatHostValue {
  usePermissions: HasanatHostHook;
  useModulePermissions: HasanatHostHook;
  useHasanatConfig: HasanatHostHook;
  useGenericModuleExport: HasanatHostHook;
  useBrandPalette: HasanatHostHook;
  useMessageComposerState: HasanatHostHook;
  useBranding: HasanatHostHook;
  useWorkspaceToday: HasanatHostHook;
  useSessionsCollection: HasanatHostHook;
  useModuleSettingsEditor: HasanatHostHook;
  ModuleReportsTier: ComponentType<any>;
  TenantMessageComposer: ComponentType<any>;
  UserActorSelect: ComponentType<any>;
  RegistryPersonSelect: ComponentType<any>;
  SessionClassSectionSelect: ComponentType<any>;
  useStaticEntityDescriptor: HasanatHostHook;
  hasanatEntityDescriptor: unknown;
  sessionIdForClass: HasanatHostHook;
}

const HasanatHostContext = createContext<HasanatHostValue | null>(null);

export const HasanatHostProvider = HasanatHostContext.Provider;

/**
 * App-bound hasanat host: RBAC, standard-module config, shared export/composer
 * hooks and the reports tier stay app-side. Module UI never imports `@/…`.
 */
export function useHasanatHost(): HasanatHostValue {
  const value = useContext(HasanatHostContext);
  if (value) return value;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("HasanatHostProvider is missing above this component");
}

const allow = () => true;
const emptyHook = () => ({});
const TEST_HOST: HasanatHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({
    canRead: true,
    canWrite: true,
    canManage: true,
    canDelete: true,
    canExport: true,
    canReports: true,
    canViewSetup: true,
    canEditSetup: true,
    canOverrideLock: true,
    canClearLogs: true,
    canRestoreLogs: true,
  }),
  useHasanatConfig: emptyHook,
  useGenericModuleExport: () => ({ handleExport: async () => {}, isExporting: false }),
  useBrandPalette: emptyHook,
  useMessageComposerState: emptyHook,
  useBranding: emptyHook,
  useWorkspaceToday: () => "2026-01-01",
  useSessionsCollection: () => [],
  useModuleSettingsEditor: emptyHook,
  ModuleReportsTier: () => null,
  TenantMessageComposer: () => null,
  UserActorSelect: () => null,
  RegistryPersonSelect: () => null,
  SessionClassSectionSelect: () => null,
  useStaticEntityDescriptor: () => ({}),
  hasanatEntityDescriptor: {},
  sessionIdForClass: () => "",
};
