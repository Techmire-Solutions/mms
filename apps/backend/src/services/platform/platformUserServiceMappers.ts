import type { PlatformUser, StoredPlatformUser, PlatformUserProfile } from "@mms/shared";
import { countPlatformUserRows } from "../../db/repositories/platformUserRepository.js";

export async function countPlatformUsers(): Promise<number> {
  return countPlatformUserRows();
}

export async function hasPlatformUsers(): Promise<boolean> {
  return (await countPlatformUserRows()) > 0;
}

export function toPlatformUserProfile(stored: StoredPlatformUser): PlatformUserProfile {
  return {
    id: stored.id,
    email: stored.email,
    name: stored.name,
    phone: stored.phone,
    role: stored.role,
    permissions: stored.permissions,
    createdAt: stored.createdAt,
    emailVerifiedAt: stored.emailVerifiedAt,
    disabledAt: stored.disabledAt ?? null,
  };
}

export function toPublicPlatformUser(user: StoredPlatformUser): PlatformUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    permissions: user.permissions,
  };
}
