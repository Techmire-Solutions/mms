import type { platformWorkspacesContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../lib/contractRouterTypes.js";
import type { PlatformAuthenticatedRequest } from "../../middleware/authenticatePlatform.js";
import {
  deleteWorkspace,
  getWorkspaceGrantedModules,
  listPlatformWorkspaces,
  getPlatformWorkspaceMetrics,
  getPlatformWorkspaceSummary,
  setWorkspaceEmailVerification,
  setWorkspaceEnabled,
  updateWorkspaceModules,
} from "../../services/workspaceService.js";
import { verifyPlatformUserPassword } from "../../services/platform/platformUserService.js";
import { insertPlatformActivityLog } from "../../platform/use-cases/platformUseCases.js";
import { blockTenant, unblockTenant } from "../../services/authSessionService.js";

export async function handleListWorkspaces({
  query,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["listWorkspaces"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["listWorkspaces"]>
> {
  const result = await listPlatformWorkspaces(query ?? {});
  return { status: 200 as const, body: result };
}

export async function handleGetWorkspaceMetrics(): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["getWorkspaceMetrics"]>
> {
  const metrics = await getPlatformWorkspaceMetrics();
  return { status: 200 as const, body: metrics };
}

export async function handlePatchWorkspace({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["patchWorkspace"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["patchWorkspace"]>
> {
  const { platformUser } = request as PlatformAuthenticatedRequest;
  const updated = await setWorkspaceEnabled(params.subdomain, body.enabled);
  if (!updated) {
    return { status: 404 as const, body: { type: "not_found", message: "Workspace not found" } };
  }

  if (body.enabled) {
    await unblockTenant(params.subdomain);
  } else {
    await blockTenant(params.subdomain);
  }

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "toggle_workspace",
    targetResource: "workspace",
    targetId: params.subdomain,
    metadataMessage: `Set enabled=${body.enabled}`,
    ipAddress: request.ip,
  });

  const row = await getPlatformWorkspaceSummary(updated.subdomain);
  return { status: 200 as const, body: { workspace: row ?? undefined } };
}

export async function handleGetWorkspaceModules({
  params,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["getWorkspaceModules"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["getWorkspaceModules"]>
> {
  const modules = await getWorkspaceGrantedModules(params.subdomain);
  return { status: 200 as const, body: { modules } };
}

export async function handleUpdateWorkspaceModules({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["updateWorkspaceModules"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["updateWorkspaceModules"]>
> {
  const { platformUser } = request as PlatformAuthenticatedRequest;
  const result = await updateWorkspaceModules(params.subdomain, body.modules);

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "update_workspace_modules",
    targetResource: "workspace",
    targetId: params.subdomain,
    metadataMessage: `modules=[${body.modules.join(",")}]`,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { success: true as const, modules: result.modules } };
}

export async function handlePatchWorkspaceEmailVerification({
  params,
  body,
  request,
}: ContractRouteArgs<
  (typeof platformWorkspacesContract)["patchWorkspaceEmailVerification"]
>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["patchWorkspaceEmailVerification"]>
> {
  const { platformUser } = request as PlatformAuthenticatedRequest;
  const result = await setWorkspaceEmailVerification(
    params.subdomain,
    body.requireEmailVerification,
  );
  if (!result) {
    return { status: 404 as const, body: { type: "not_found", message: "Workspace not found" } };
  }

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "update_workspace_email_verification",
    targetResource: "workspace",
    targetId: params.subdomain,
    metadataMessage: `requireEmailVerification=${body.requireEmailVerification}`,
    ipAddress: request.ip,
  });

  return {
    status: 200 as const,
    body: {
      success: true as const,
      subdomain: result.subdomain,
      requireEmailVerification: result.requireEmailVerification,
    },
  };
}

export async function handleDeleteWorkspace({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformWorkspacesContract)["deleteWorkspace"]>): Promise<
  ContractRouteResponse<(typeof platformWorkspacesContract)["deleteWorkspace"]>
> {
  const { platformUser } = request as PlatformAuthenticatedRequest;
  if (platformUser.role !== "super_user") {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Super-user privilege required" },
    };
  }

  const passwordOk = await verifyPlatformUserPassword(platformUser.id, body.password);
  if (!passwordOk) {
    return {
      status: 401 as const,
      body: { type: "invalid_current_password", message: "Current password is incorrect" },
    };
  }

  if (body.confirmSubdomain.trim().toLowerCase() !== params.subdomain.toLowerCase()) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error",
        message: "Confirmation subdomain does not match the workspace being deleted",
      },
    };
  }

  const removed = await deleteWorkspace(params.subdomain);
  if (!removed) {
    return { status: 404 as const, body: { type: "not_found", message: "Workspace not found" } };
  }

  await blockTenant(params.subdomain);

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "delete_workspace",
    targetResource: "workspace",
    targetId: params.subdomain,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { deleted: true as const, subdomain: removed.subdomain } };
}
