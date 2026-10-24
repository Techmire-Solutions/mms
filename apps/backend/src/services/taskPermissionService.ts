import type { FastifyRequest } from "fastify";
import { roleHasPermission, type Permission, type User } from "@mms/shared";
import { resolveCurrentTenantRole } from "../lib/currentTenantRole.js";
import { getTenantUsersSettings } from "./users/usersSettingsService.js";

export async function canPerformTaskAction(
  request: FastifyRequest,
  permission: Permission,
): Promise<boolean> {
  const user = request.user as User | undefined;
  const tenant = request.tenant?.id;
  if (!tenant || !user?.id) return false;
  const role = await resolveCurrentTenantRole(tenant, user.id, user.role);
  if (!role) return false;
  const settings = await getTenantUsersSettings();
  return roleHasPermission(role, permission, settings.workspaceRoles);
}
