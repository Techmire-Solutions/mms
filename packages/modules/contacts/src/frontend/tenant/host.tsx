import { createContext, useContext, type ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { AppTranslationKey } from "@mms/contracts";
import { ModulePageShell } from "@mms/fe-core/components/ModulePageShell";
import { ResponsiveAccordionTabs } from "@mms/fe-core/components/ResponsiveAccordionTabs";
import { useTranslation } from "@mms/fe-core/i18n";
import type { Permission } from "@mms/contracts";

/** Module permission flags resolved from a module manifest. */
export interface ContactsModulePermissions {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  canDelete: boolean;
  canExport: boolean;
  canReports: boolean;
  canViewSetup: boolean;
  canEditSetup: boolean;
  canOverrideLock: boolean;
  canClearLogs: boolean;
  canRestoreLogs: boolean;
}

export interface ContactsModulePermissionsManifest {
  permissions: Record<string, Permission | undefined>;
}

/** Loose callable shape for host-bound query/mutation hooks. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContactsHostHook = (...args: any[]) => any;

export interface ContactsHostValue {
  usePermissions: () => {
    role?: string;
    can: (permission: Permission) => boolean;
    canAny: (...permissions: readonly Permission[]) => boolean;
    canAll: (...permissions: readonly Permission[]) => boolean;
    permissions: readonly Permission[];
  };
  useModulePermissions: (manifest: ContactsModulePermissionsManifest) => ContactsModulePermissions;
  useContactMutations: ContactsHostHook;
  useModuleTierPageNav: ContactsHostHook;
  useMessageComposerState: ContactsHostHook;
  useContactPickerSearch: ContactsHostHook;
  useContactPickerOption: ContactsHostHook;
  useContactPreferencesQuery: ContactsHostHook;
  useContactPreferencesMutation: ContactsHostHook;
  useContactLookupsQuery: ContactsHostHook;
  useContactLookupMutation: ContactsHostHook;
  useContactsContractFieldConfig: ContactsHostHook;
  useContactsContractUpdateFieldConfig: ContactsHostHook;
  ModuleTierPage: ComponentType<any>;
  TenantMessageComposer: ComponentType<any>;
  ModuleReportsTier: ComponentType<any>;
}

/** Module tier page spec (mirrors the app scaffold). */
export interface ModuleTierPageSpec {
  seoTitleKey?: AppTranslationKey;
  seoTitle?: string;
  subtitleKey: AppTranslationKey;
  headerTitleKey?: AppTranslationKey;
  headerTitle?: string;
  headerIcon?: LucideIcon;
  panelIdPrefix: string;
}

/** Cross-module query keys the contacts invalidator needs (app-owned features). */
export interface ContactsCrossModuleQueryKeys {
  messagingContactsResolve: readonly unknown[];
  messagingRecipients: readonly unknown[];
  studentsMetrics: readonly unknown[];
  students: readonly unknown[];
}

const ContactsHostContext = createContext<ContactsHostValue | null>(null);

export const ContactsHostProvider = ContactsHostContext.Provider;

/**
 * App-bound contacts host. The app provides RBAC and the contacts query surface,
 * so module UI never imports `@/…`; once the feature moves its own hooks into the
 * module, only `useModulePermissions` stays app-bound.
 */
function TestModuleTierPage(props: any): React.JSX.Element {
  const { t } = useTranslation();
  const { spec, tabs, activeTab, onTabChange, headerActions, metrics, banner, tiers, overlays } =
    props;
  const subtitle = t(spec.subtitleKey);
  const headerTitle = spec.headerTitle ?? (spec.headerTitleKey ? t(spec.headerTitleKey) : "");
  const active = tiers.find((tier: any) => tier.id === activeTab);
  return (
    <ModulePageShell
      seoTitle={headerTitle}
      seoDescription={subtitle}
      headerTitle={headerTitle}
      headerSubtitle={subtitle}
      headerActions={headerActions}
      metricsStrip={metrics}
    >
      {banner}
      <ResponsiveAccordionTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        panelIdPrefix={spec.panelIdPrefix}
      >
        {active ? active.content : null}
      </ResponsiveAccordionTabs>
      {overlays}
    </ModulePageShell>
  );
}

const permissive = () => true;
const TEST_HOST: ContactsHostValue = {
  usePermissions: () => ({
    role: "admin",
    can: permissive,
    canAny: permissive,
    canAll: permissive,
    permissions: [],
  }),
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
  useContactMutations: () => ({}),
  useContactPickerSearch: () => ({ data: undefined, isFetching: false }),
  useContactPickerOption: () => ({ data: undefined }),
  useContactPreferencesQuery: () => ({ data: undefined }),
  useContactPreferencesMutation: () => ({ mutateAsync: async () => {} }),
  useContactLookupsQuery: () => ({ data: undefined, isLoading: false, error: null }),
  useContactLookupMutation: () => ({ mutateAsync: async () => {} }),
  useContactsContractFieldConfig: () => ({ data: undefined }),
  useContactsContractUpdateFieldConfig: () => ({ mutateAsync: async () => {} }),
  useModuleTierPageNav: () => ({}),
  useMessageComposerState: () => ({}),
  ModuleTierPage: TestModuleTierPage,
  TenantMessageComposer: () => null,
  ModuleReportsTier: () => null,
};

export function useContactsHost(): ContactsHostValue {
  const value = useContext(ContactsHostContext);
  if (value) return value;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("ContactsHostProvider is missing above this component");
}
