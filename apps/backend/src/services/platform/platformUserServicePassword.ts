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

export async function updatePlatformUserPassword(
  userId: string,
  passwordHash: string,
): Promise<StoredPlatformUser> {
  const existing = await findPlatformUserRowById(userId);
  if (!existing) throw new PlatformError("user_not_found", "Platform user not found");
  const updated = await updatePlatformUserRow(userId, {
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

export async function changePlatformUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<StoredPlatformUser> {
  const stored = await findPlatformUserRowById(userId);
  if (!stored) throw new PlatformError("user_not_found", "Platform user not found");

  const ok = await verifyPassword(currentPassword, stored.passwordHash);
  if (!ok) throw new PlatformError("invalid_current_password", "Current password is incorrect");

  const updated = await updatePlatformUserRow(userId, {
    passwordHash: await hashPassword(newPassword),
    sessionVersion: stored.sessionVersion + 1,
  });
  if (!updated) throw new PlatformError("user_not_found", "Platform user not found");
  if (updated.role === "super_user") {
    const { syncPlatformSuperUserToTenants } =
      await import("./platformSuperUserTenantSyncService.js");
    await syncPlatformSuperUserToTenants(updated);
  }
  return updated;
}
