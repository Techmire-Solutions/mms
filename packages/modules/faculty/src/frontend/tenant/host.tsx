import React, { createContext, useContext, type ComponentType } from "react";

/** Loose callable shape for host-bound query/hook surfaces. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FacultyHostHook = (...args: any[]) => any;

export interface FacultyHostValue {
  useFacultyConfig: FacultyHostHook;
  useWorkspaceRoles: FacultyHostHook;
  usePermissions: FacultyHostHook;
  useModulePermissions: FacultyHostHook;
  useWorkspaceToday: FacultyHostHook;
  useBranding: FacultyHostHook;
  useIndustryTerminology: FacultyHostHook;
  useMessageComposerState: FacultyHostHook;
  useModuleSettingsEditor: FacultyHostHook;
  users: {
    useUsersContractList: FacultyHostHook;
    useCreateWorkspaceRole: FacultyHostHook;
    RoleFormModal: ComponentType<any>;
  };
  sessions: { useSessions: FacultyHostHook; useSessionsCollection: FacultyHostHook };
  contacts: { useContactById: FacultyHostHook };
  ContactPicker: ComponentType<any>;
  ModuleTierPage: ComponentType<any>;
  ModuleReports: ComponentType<any>;
  KPISummary: ComponentType<any>;
  TenantMessageComposer: ComponentType<any>;
}

const FacultyHostContext = createContext<FacultyHostValue | null>(null);

export const FacultyHostProvider = FacultyHostContext.Provider;

/**
 * App-bound faculty host: RBAC, standard-module config, cross-feature collections
 * and shared app widgets stay app-side. Module UI never imports `@/…`.
 */
export function useFacultyHost(): FacultyHostValue {
  const value = useContext(FacultyHostContext);
  if (value) return value;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("FacultyHostProvider is missing above this component");
}

function TestModuleTierPage(props: any): React.JSX.Element {
  const active = props.tiers?.find((tier: any) => tier.id === props.activeTab);
  return (
    <div>
      <h1>{props.spec?.headerTitle ?? props.spec?.headerTitleKey ?? ""}</h1>
      {props.banner}
      {props.headerActions}
      {props.metrics}
      {active ? <React.Suspense fallback={null}>{active.content}</React.Suspense> : null}
      {props.overlays}
    </div>
  );
}

const allow = () => true;
const emptyHook = () => ({});
const T = () => null;
const TEST_HOST: FacultyHostValue = {
  useFacultyConfig: () => ({
    fields: {} as Record<string, unknown>,
    orderedFields: [] as Array<{ id: string }>,
    isFieldEnabled: allow,
    isFieldRequired: allow,
  }),
  useWorkspaceRoles: () => [],
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useWorkspaceToday: () => "2026-01-01",
  useBranding: () => ({}),
  useIndustryTerminology: () => ({}),
  useMessageComposerState: emptyHook,
  useModuleSettingsEditor: emptyHook,
  users: {
    useUsersContractList: () => ({ data: [] }),
    useCreateWorkspaceRole: emptyHook,
    RoleFormModal: T,
  },
  sessions: { useSessions: () => ({ data: [] }), useSessionsCollection: () => [] },
  contacts: { useContactById: () => ({ data: null }) },
  ContactPicker: T,
  ModuleTierPage: TestModuleTierPage,
  ModuleReports: T,
  KPISummary: T,
  TenantMessageComposer: T,
};
