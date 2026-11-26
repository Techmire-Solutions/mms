import type { UsersRepository } from "../repository/usersRepository.js";
import { requireTenant } from "@mms/be-core/http";
import { broadcastCollection } from "@mms/be-core/realtime";
import { invalidateTenantRbac } from "../deps.js";
import { HttpDomainError } from "@mms/be-core/http/errors";
import { canManageTargetUser } from "@mms/contracts";
import { recordUserActivityLog } from "./userActivityLogUseCases.js";

export async function restoreUserByIdHelper(
  repo: UsersRepository,
  id: string,
  actorRole?: string,
  actorId = "system",
  ip = "127.0.0.1",
): Promise<boolean> {
  const tenant = requireTenant();
  const existing = await repo.findTenantUserRowById(tenant, id);
  if (!existing) return false;

  if (actorRole && !canManageTargetUser(actorRole, existing.role)) {
    throw new HttpDomainError(
      403,
      "forbidden_super_admin_mutation",
      "Cannot restore a Super Admin user account",
    );
  }

  const ok = await repo.restoreTenantUserRow(tenant, id);
  if (ok) {
    await invalidateTenantRbac(tenant);
    await broadcastCollection("users");

    await recordUserActivityLog(
      repo,
      tenant,
      actorId,
      "update",
      `Restored user ${existing.name || id}`,
      ip,
    );
  }
  return ok;
}

export async function verifyUserEmailByIdHelper(
  repo: UsersRepository,
  id: string,
  actorRole?: string,
  actorId = "system",
  ip = "127.0.0.1",
): Promise<boolean> {
  const tenant = requireTenant();
  const existing = await repo.findTenantUserRowById(tenant, id);
  if (!existing) return false;

  if (actorRole && !canManageTargetUser(actorRole, existing.role)) {
    throw new HttpDomainError(
      403,
      "forbidden_super_admin_mutation",
      "Cannot modify a Super Admin user account",
    );
  }

  const ok = await repo.verifyTenantUserEmailRow(tenant, id);
  if (ok) {
    await broadcastCollection("users");
    await recordUserActivityLog(
      repo,
      tenant,
      actorId,
      "update",
      `Verified email for user ${existing.name || id}`,
      ip,
    );
  }
  return ok;
}
