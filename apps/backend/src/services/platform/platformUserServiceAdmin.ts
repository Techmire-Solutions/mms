import { randomBytes } from "node:crypto";
import type {
  PlatformRole,
  PlatformAdminPermissions,
  PlatformUserProfile,
  StoredPlatformUser,
} from "@mms/shared";
import {
  DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
  FULL_PLATFORM_ADMIN_PERMISSIONS,
  normalizePlatformAdminPermissions,
} from "@mms/shared";
import {
  insertPlatformUser,
  updatePlatformUserRow,
  deletePlatformUserRow,
} from "../../db/repositories/platformUserRepository.js";
import { PlatformError } from "./platformErrorService.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { countPlatformUsers, toPlatformUserProfile } from "./platformUserServiceMappers.js";
import { findPlatformUserByEmail, getStoredPlatformUserById } from "./platformUserServiceRead.js";

export async function createVerifiedPlatformUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role?: PlatformRole;
  permissions?: PlatformAdminPermissions;
}): Promise<StoredPlatformUser> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new PlatformError("invalid_name", "Name cannot be empty");

  const existing = await findPlatformUserByEmail(normalizedEmail);
  if (existing) throw new PlatformError("user_exists", "Platform user already exists");

  const count = await countPlatformUsers();
  if (input.role === undefined && count > 0) {
    throw new PlatformError("setup_not_needed", "Platform administrator already exists");
  }

  const role = input.role ?? (count === 0 ? "super_user" : "admin");
  const permissions =
    role === "super_user"
      ? FULL_PLATFORM_ADMIN_PERMISSIONS
      : normalizePlatformAdminPermissions(input.permissions ?? DEFAULT_PLATFORM_ADMIN_PERMISSIONS);

  const user: StoredPlatformUser = {
    id: randomBytes(8).toString("hex"),
    email: normalizedEmail,
    name: trimmedName,
    passwordHash: input.passwordHash,
    role,
    permissions,
    sessionVersion: 0,
    createdAt: new Date().toISOString(),
    emailVerifiedAt: new Date().toISOString(),
  };

  try {
    await insertPlatformUser(user);
    if (role === "super_user") {
      const { syncPlatformSuperUserToTenants } =
        await import("./platformSuperUserTenantSyncService.js");
      await syncPlatformSuperUserToTenants(user);
    }
  } catch (error: unknown) {
    // Concurrent duplicate inserts (setup super-user or admin create) hit the
    // unique constraints — map them to the same user-facing errors as the
    // pre-insert existence checks instead of leaking a raw 500.
    if (isUniqueViolation(error)) {
      if (role === "super_user") {
        throw new PlatformError("setup_not_needed", "Platform administrator already exists");
      }
      throw new PlatformError("user_exists", "Platform user already exists");
    }
    throw error;
  }
  return user;
}

export async function setPlatformAdminPermissions(
  userId: string,
  permissions: PlatformAdminPermissions,
): Promise<PlatformUserProfile> {
  const stored = await getStoredPlatformUserById(userId);
  if (!stored) throw new PlatformError("user_not_found", "Platform user not found");
  if (stored.role === "super_user") {
    throw new PlatformError("forbidden", "Cannot change permissions for a platform super-user");
  }

  const updated = await updatePlatformUserRow(userId, {
    permissions: normalizePlatformAdminPermissions(permissions),
    sessionVersion: stored.sessionVersion + 1,
  });
  if (!updated) throw new PlatformError("user_not_found", "Platform user not found");
  return toPlatformUserProfile(updated);
}

/** Soft-disable or re-enable a platform admin. Super-users cannot be disabled. */
export async function setPlatformAdminDisabled(
  userId: string,
  disabled: boolean,
): Promise<PlatformUserProfile> {
  const stored = await getStoredPlatformUserById(userId);
  if (!stored) throw new PlatformError("user_not_found", "Platform user not found");
  if (stored.role === "super_user") {
    throw new PlatformError("forbidden", "Cannot disable a platform super-user");
  }

  const updated = await updatePlatformUserRow(userId, {
    disabledAt: disabled ? new Date().toISOString() : null,
    sessionVersion: disabled ? stored.sessionVersion + 1 : stored.sessionVersion,
  });
  if (!updated) throw new PlatformError("user_not_found", "Platform user not found");
  return toPlatformUserProfile(updated);
}

/** Permanently remove a platform admin. Super-users cannot be deleted. */
export async function deletePlatformAdmin(userId: string): Promise<void> {
  const stored = await getStoredPlatformUserById(userId);
  if (!stored) throw new PlatformError("user_not_found", "Platform user not found");
  if (stored.role === "super_user") {
    throw new PlatformError("forbidden", "Cannot delete a platform super-user");
  }

  const removed = await deletePlatformUserRow(userId);
  if (!removed) throw new PlatformError("user_not_found", "Platform user not found");
}

export async function verifyPlatformUserEmail(userId: string): Promise<PlatformUserProfile> {
  const stored = await getStoredPlatformUserById(userId);
  if (!stored) throw new PlatformError("user_not_found", "Platform user not found");

  const updated = await updatePlatformUserRow(userId, {
    emailVerifiedAt: new Date().toISOString(),
  });
  if (!updated) throw new PlatformError("user_not_found", "Platform user not found");
  return toPlatformUserProfile(updated);
}
