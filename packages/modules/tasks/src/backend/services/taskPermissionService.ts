import type { FastifyRequest } from "fastify";
import { roleHasPermission, type Permission, type User } from "@mms/contracts";
import { resolveCurrentTenantRole } from "@mms/be-core/rbac";
import { getTenantUsersSettings } from "../deps.js";

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
