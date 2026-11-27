import { createElement } from "react";
import type { ComponentType } from "react";

export type IamHostHook = (...args: any[]) => any;

/** App-bound surface for the IAM tenant (users) feature. */
export interface IamHostValue {
  usePermissions: IamHostHook;
  useModulePermissions: IamHostHook;
  useWorkspaceRoles: IamHostHook;
  useGlobalSettings: IamHostHook;
  useModuleSettingsEditor: IamHostHook;
  useUsersConfig: IamHostHook;
  useWorkspaceToday: IamHostHook;
  useMessageComposerState: IamHostHook;
  useContactById: IamHostHook;
  useUsersContractVerifyEmail: IamHostHook;
  reportDateUtils: { calculateReportDateRange: (...args: any[]) => any };
  ContactPicker: ComponentType<any>;
  TenantMessageComposerLauncher: ComponentType<any>;
  ReportDataGridContainer: ComponentType<any>;
}

let configured: IamHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureIamHost(next: IamHostValue): void {
  configured = next;
}

/** App-bound host. Module UI never imports `@/…`. */
export function getIamHost(): IamHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("IAM host is not configured (call configureIamHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: IamHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useWorkspaceRoles: () => [
    { id: "admin", name: "Admin", description: "" },
    { id: "teacher", name: "Teacher", description: "" },
    { id: "staff", name: "Staff", description: "" },
  ],
  useGlobalSettings: () => ({}),
  useModuleSettingsEditor: () => ({
    draft: {},
    setDraft: allow,
    save: allow,
    discardDrafts: allow,
  }),
  useUsersConfig: () => ({ statuses: [], defaults: {} }),
  useWorkspaceToday: () => "2026-01-01",
  useMessageComposerState: () => ({}),
  useContactById: () => undefined,
  useUsersContractVerifyEmail: () => ({ mutate: allow, mutateAsync: allow, isPending: false }),
  reportDateUtils: { calculateReportDateRange: () => ({ from: "2026-01-01", to: "2026-01-31" }) },
  ContactPicker: T,
  TenantMessageComposerLauncher: T,
  ReportDataGridContainer: ({ children }: { children?: unknown }) =>
    createElement("div", { "data-testid": "report-grid" }, children as never),
};
