import type { platformWorkspacesContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../lib/contractRouterTypes.js";
import type { PlatformAuthenticatedRequest } from "../../middleware/authenticatePlatform.js";
import {
  createWorkspaceAdminUser,
  resetWorkspaceAdminPassword,
} from "../../services/workspaceService.js";
import { verifyPlatformUserPassword } from "../../services/platform/platformUserService.js";
import { insertPlatformActivityLog } from "../../db/repositories/platformActivityLogsRepository.js";

export async function handleVerifyTenantUserEmail({
  params,
  request,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["verifyTenantUserEmail"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["verifyTenantUserEmail"]>
> {
  const { platformUser } = request as PlatformAuthenticatedRequest;
  const { subdomain, userId } = params;

  const { verifyTenantUserEmailRow, findTenantUserRowById } =
    await import("../../db/repositories/tenantUserRepository.js");

  const user = await findTenantUserRowById(subdomain, userId);
  if (!user) {
    return {
      status: 404 as const,
      body: { type: "not_found", message: "User not found in workspace" },
    };
  }

  const ok = await verifyTenantUserEmailRow(subdomain, userId);
  if (!ok) {
    return {
      status: 404 as const,
      body: { type: "not_found", message: "User not found in workspace" },
    };
  }

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "verify_tenant_user_email",
    targetResource: "workspace_user",
    targetId: `${subdomain}:${userId}`,
    metadataMessage: `Verified tenant user ${userId} in ${subdomain}`,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { success: true as const } };
}

export async function handleResetWorkspaceAdminPassword({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["resetWorkspaceAdminPassword"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["resetWorkspaceAdminPassword"]>
> {
  const { platformUser } = request as PlatformAuthenticatedRequest;
  const passwordOk = await verifyPlatformUserPassword(platformUser.id, body.password);
  if (!passwordOk) {
    return {
      status: 401 as const,
      body: { type: "invalid_current_password", message: "Current password is incorrect" },
    };
  }

  const result = await resetWorkspaceAdminPassword(params.subdomain, body.newPassword);
  if (!result) {
    return { status: 404 as const, body: { type: "not_found", message: "Workspace not found" } };
  }

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "reset_workspace_admin_password",
    targetResource: "workspace",
    targetId: params.subdomain,
    metadataMessage: `Reset password for admin email ${result.adminEmail}`,
    ipAddress: request.ip,
  });

  return {
    status: 200 as const,
    body: {
      success: true as const,
      subdomain: result.subdomain,
      adminEmail: result.adminEmail,
      newPassword: result.newPassword,
    },
  };
}

export async function handleCreateWorkspaceAdminUser({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["createWorkspaceAdminUser"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["createWorkspaceAdminUser"]>
> {
  const { platformUser } = request as PlatformAuthenticatedRequest;
  const passwordOk = await verifyPlatformUserPassword(platformUser.id, body.currentPassword);
  if (!passwordOk) {
    return {
      status: 401 as const,
      body: { type: "invalid_current_password", message: "Current password is incorrect" },
    };
  }

  const result = await createWorkspaceAdminUser(params.subdomain, {
    name: body.name,
    email: body.email,
    password: body.password,
  });
  if (!result.success) {
    if (result.error === "WORKSPACE_NOT_FOUND") {
      return { status: 404 as const, body: { type: "not_found", message: "Workspace not found" } };
    }
    return {
      status: 409 as const,
      body: {
        type: "conflict",
        message: "An admin user with this email already exists in this workspace.",
      },
    };
  }

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "create_workspace_admin_user",
    targetResource: "workspace",
    targetId: params.subdomain,
    metadataMessage: `Created admin user ${result.name} (${result.adminEmail})`,
    ipAddress: request.ip,
  });

  return {
    status: 200 as const,
    body: {
      success: true as const,
      subdomain: result.subdomain,
      adminEmail: result.adminEmail,
      name: result.name,
      initialPassword: result.initialPassword,
    },
  };
}
