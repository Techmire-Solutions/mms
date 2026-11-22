import {
  findPlatformUserRowById,
  updatePlatformUserRow,
} from "../../db/repositories/platformUserRepository.js";
import type { StoredPlatformUser } from "@mms/shared";
import { hashPassword, verifyPassword } from "../auth/passwordService.js";
import { PlatformError } from "./platformErrorService.js";

export async function verifyPlatformUserPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const stored = await findPlatformUserRowById(userId);
  if (!stored) return false;
  return verifyPassword(password, stored.passwordHash);
}

/**
 * Single persistence path for every platform password write: bumps
 * `sessionVersion` (invalidating every outstanding apex token) and re-syncs the
 * super-user credentials into tenant workspaces. `updatePlatformUserPassword`
 * and `changePlatformUserPassword` used to carry duplicate copies of this
 * block (mms-dry §2).
 */
async function applyPlatformUserPasswordUpdate(
  existing: StoredPlatformUser,
  passwordHash: string,
): Promise<StoredPlatformUser> {
  const updated = await updatePlatformUserRow(existing.id, {
    passwordHash,
    sessionVersion: existing.sessionVersion + 1,
  });
  if (!updated) throw new PlatformError("user_not_found", "Platform user not found");
  if (updated.role === "super_user") {
    const { syncPlatformSuperUserToTenants } =
      await import("./platformSuperUserTenantSyncService.js");
    await syncPlatformSuperUserToTenants(updated);
  }
  return updated;
}

export async function updatePlatformUserPassword(
  userId: string,
  passwordHash: string,
): Promise<StoredPlatformUser> {
  const existing = await findPlatformUserRowById(userId);
  if (!existing) throw new PlatformError("user_not_found", "Platform user not found");
  return applyPlatformUserPasswordUpdate(existing, passwordHash);
}

export async function changePlatformUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<StoredPlatformUser> {
  const stored = await findPlatformUserRowById(userId);
  if (!stored) throw new PlatformError("user_not_found", "Platform user not found");

  const ok = await verifyPassword(currentPassword, stored.passwordHash);
  if (!ok) throw new PlatformError("invalid_current_password", "Current password is incorrect");

  return applyPlatformUserPasswordUpdate(stored, await hashPassword(newPassword));
}
