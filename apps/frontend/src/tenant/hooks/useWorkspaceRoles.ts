import { cloneDefaultWorkspaceRoles, type WorkspaceRole } from "@mms/shared";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";

/** Live workspace roles from `users_settings` (system + custom). */
export function useWorkspaceRoles(): WorkspaceRole[] {
  const { settings } = useUsersConfig();

  const roles = (() => {
    if (settings.workspaceRoles?.length) {
      return settings.workspaceRoles.map((r) => ({
        ...r,
        permissions: structuredClone(r.permissions),
      }));
    }
    return cloneDefaultWorkspaceRoles();
  })();

  return roles;
}
