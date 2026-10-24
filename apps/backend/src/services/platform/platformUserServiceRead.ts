import type { PlatformUserProfile } from "@mms/shared";
import {
  findPlatformUserRowByEmail,
  findPlatformUserRowById,
  updatePlatformUserRow,
} from "../../db/repositories/platformUserRepository.js";
import type { StoredPlatformUser } from "@mms/shared";
import { PlatformError } from "./platformErrorService.js";
import { toPlatformUserProfile } from "./platformUserServiceMappers.js";

export async function getPlatformUserProfile(userId: string): Promise<PlatformUserProfile | null> {
  const stored = await getStoredPlatformUserById(userId);
  if (!stored) return null;
  return toPlatformUserProfile(stored);
}

export async function findPlatformUserByEmail(email: string): Promise<StoredPlatformUser | null> {
  return findPlatformUserRowByEmail(email.trim().toLowerCase());
}

export async function getStoredPlatformUserById(id: string): Promise<StoredPlatformUser | null> {
  return findPlatformUserRowById(id);
}

export async function updatePlatformUserName(
  userId: string,
  name: string,
): Promise<StoredPlatformUser> {
  return updatePlatformUserNameAndPhone(userId, { name });
}

export async function updatePlatformUserNameAndPhone(
  userId: string,
  patch: { name?: string; phone?: string },
): Promise<StoredPlatformUser> {
  const rowPatch: { name?: string; phone?: string } = {};
  if (patch.name !== undefined) {
    const trimmedName = patch.name.trim();
    if (!trimmedName) throw new PlatformError("invalid_name", "Name cannot be empty");
    rowPatch.name = trimmedName;
  }
  if (patch.phone !== undefined) {
    rowPatch.phone = patch.phone.trim();
  }

  const updated = await updatePlatformUserRow(userId, rowPatch);
  if (!updated) throw new PlatformError("user_not_found", "Platform user not found");
  if (updated.role === "super_user") {
    const { syncPlatformSuperUserToTenants } =
      await import("./platformSuperUserTenantSyncService.js");
    await syncPlatformSuperUserToTenants(updated);
  }
  return updated;
}

export async function updatePlatformUserProfile(
  userId: string,
  patch: { name?: string; phone?: string },
): Promise<PlatformUserProfile> {
  const updated = await updatePlatformUserNameAndPhone(userId, patch);
  return toPlatformUserProfile(updated);
}
