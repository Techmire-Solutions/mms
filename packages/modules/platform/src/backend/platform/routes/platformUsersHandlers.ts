import type { platformAdminsContract } from "@mms/contracts";
import type { ContractRouteArgs, ContractRouteResponse } from "@mms/be-core/http/routes";
import { insertPlatformActivityLog, listPlatformUsers } from "../use-cases/platformUseCases.js";
import {
  createVerifiedPlatformUser,
  deletePlatformAdmin,
  setPlatformAdminDisabled,
  setPlatformAdminPermissions,
  toPlatformUserProfile,
  verifyPlatformUserPassword,
  verifyPlatformUserEmail,
} from "../services/platformUserService.js";
import { hashPassword } from "../deps.js";

export async function handleListAdmins(): Promise<
  ContractRouteResponse<(typeof platformAdminsContract)["listAdmins"]>
> {
  const storedUsers = await listPlatformUsers();
  const users = storedUsers.map(toPlatformUserProfile);
  return { status: 200 as const, body: { users } };
}

export async function handleCreateAdmin({
  body,
  request,
}: ContractRouteArgs<(typeof platformAdminsContract)["createAdmin"]>): Promise<
  ContractRouteResponse<(typeof platformAdminsContract)["createAdmin"]>
> {
  const { platformUser } = request as any;
  const { name, email, password, permissions, currentPassword } = body;

  const passwordOk = await verifyPlatformUserPassword(platformUser.id, currentPassword);
  if (!passwordOk) {
    return {
      status: 401 as const,
      body: { type: "invalid_current_password", message: "Current password is incorrect" },
    };
  }

  const passwordHash = await hashPassword(password);
  const stored = await createVerifiedPlatformUser({
    name: name.trim(),
    email,
    passwordHash,
    role: "admin",
    permissions,
  });

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "create_admin",
    targetResource: "admin",
    targetId: stored.id,
    metadataMessage: `Created admin ${email}`,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { user: toPlatformUserProfile(stored) } };
}

export async function handleUpdateAdminPermissions({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformAdminsContract)["updateAdminPermissions"]>): Promise<
  ContractRouteResponse<(typeof platformAdminsContract)["updateAdminPermissions"]>
> {
  const { platformUser } = request as any;
  if (params.adminId === platformUser.id) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Cannot change your own permissions" },
    };
  }

  const passwordOk = await verifyPlatformUserPassword(platformUser.id, body.password);
  if (!passwordOk) {
    return {
      status: 401 as const,
      body: { type: "invalid_current_password", message: "Current password is incorrect" },
    };
  }

  const user = await setPlatformAdminPermissions(params.adminId, body.permissions);

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "update_admin_permissions",
    targetResource: "admin",
    targetId: params.adminId,
    metadataMessage: `Updated permissions for ${user.email}`,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { user } };
}

export async function handleVerifyAdminEmail({
  params,
  request,
}: ContractRouteArgs<(typeof platformAdminsContract)["verifyAdminEmail"]>): Promise<
  ContractRouteResponse<(typeof platformAdminsContract)["verifyAdminEmail"]>
> {
  const { platformUser } = request as any;
  const user = await verifyPlatformUserEmail(params.adminId);

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "verify_admin_email",
    targetResource: "admin",
    targetId: params.adminId,
    metadataMessage: `Verified email for ${user.email}`,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { user, success: true as const } };
}

export async function handleSetAdminDisabled({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformAdminsContract)["setAdminDisabled"]>): Promise<
  ContractRouteResponse<(typeof platformAdminsContract)["setAdminDisabled"]>
> {
  const { platformUser } = request as any;
  if (params.adminId === platformUser.id) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Cannot disable your own platform account" },
    };
  }

  const passwordOk = await verifyPlatformUserPassword(platformUser.id, body.password);
  if (!passwordOk) {
    return {
      status: 401 as const,
      body: { type: "invalid_current_password", message: "Current password is incorrect" },
    };
  }

  const user = await setPlatformAdminDisabled(params.adminId, body.disabled);

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: body.disabled ? "disable_admin" : "enable_admin",
    targetResource: "admin",
    targetId: params.adminId,
    metadataMessage: `${body.disabled ? "Disabled" : "Enabled"} admin ${user.email}`,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { user } };
}

export async function handleDeleteAdmin({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof platformAdminsContract)["deleteAdmin"]>): Promise<
  ContractRouteResponse<(typeof platformAdminsContract)["deleteAdmin"]>
> {
  const { platformUser } = request as any;
  if (params.adminId === platformUser.id) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Cannot delete your own platform account" },
    };
  }

  const passwordOk = await verifyPlatformUserPassword(platformUser.id, body.password);
  if (!passwordOk) {
    return {
      status: 401 as const,
      body: { type: "invalid_current_password", message: "Current password is incorrect" },
    };
  }

  await deletePlatformAdmin(params.adminId);

  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "delete_admin",
    targetResource: "admin",
    targetId: params.adminId,
    ipAddress: request.ip,
  });

  return { status: 200 as const, body: { deleted: true as const, id: params.adminId } };
}
