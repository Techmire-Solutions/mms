import { getAccountingHost } from "../host.js";

export function useModulePermissions(config?: unknown): {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  canDelete: boolean;
  canEditSetup: boolean;
  canReports: boolean;
  canViewSetup: boolean;
} {
  return getAccountingHost().useModulePermissions(config);
}

export function usePermissions(): { can: (permission: string) => boolean; permissions: string[] } {
  return getAccountingHost().usePermissions();
}
