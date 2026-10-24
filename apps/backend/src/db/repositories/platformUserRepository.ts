import { eq } from "drizzle-orm";
import {
  type StoredPlatformUser,
  type PlatformAdminPermissions,
  applyTitleCaseRecursive,
  normalizePlatformAdminPermissions,
  FULL_PLATFORM_ADMIN_PERMISSIONS,
} from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { platformUsers, platformUserPermissions } from "../schema.js";
import { PERMISSION_KEYS, findPlatformUserRowById } from "./platformUserQueries.js";

export * from "./platformUserQueries.js";

async function writePermissions(
  userId: string,
  permissions: PlatformAdminPermissions,
  client: ReturnType<typeof activeDb> = activeDb(),
): Promise<void> {
  await client
    .delete(platformUserPermissions)
    .where(eq(platformUserPermissions.platformUserId, userId));

  const rows = PERMISSION_KEYS.map((key) => ({
    platformUserId: userId,
    permissionKey: key,
    isGranted: Boolean(permissions[key]),
  }));
  if (rows.length > 0) {
    await client.insert(platformUserPermissions).values(rows);
  }
}

export async function insertPlatformUser(user: StoredPlatformUser): Promise<void> {
  const processedUser = applyTitleCaseRecursive(user) as StoredPlatformUser;
  const permissions =
    processedUser.role === "super_user"
      ? FULL_PLATFORM_ADMIN_PERMISSIONS
      : normalizePlatformAdminPermissions(processedUser.permissions);

  await activeDb().transaction(async (tx) => {
    const client = tx as unknown as ReturnType<typeof activeDb>;
    await client.insert(platformUsers).values({
      id: processedUser.id,
      email: processedUser.email.toLowerCase(),
      name: processedUser.name,
      passwordHash: processedUser.passwordHash,
      role: processedUser.role,
      sessionVersion: processedUser.sessionVersion ?? 0,
      emailVerifiedAt: processedUser.emailVerifiedAt
        ? new Date(processedUser.emailVerifiedAt)
        : null,
      disabledAt: processedUser.disabledAt ? new Date(processedUser.disabledAt) : null,
      createdAt: new Date(processedUser.createdAt),
    });

    await writePermissions(processedUser.id, permissions, client);
  });
}

export async function updatePlatformUserRow(
  userId: string,
  patch: Partial<
    Pick<
      StoredPlatformUser,
      | "email"
      | "name"
      | "phone"
      | "passwordHash"
      | "emailVerifiedAt"
      | "role"
      | "permissions"
      | "sessionVersion"
      | "disabledAt"
    >
  >,
): Promise<StoredPlatformUser | null> {
  const existing = await findPlatformUserRowById(userId);
  if (!existing) return null;

  const processedPatch = applyTitleCaseRecursive(patch) as typeof patch;
  const next: StoredPlatformUser = {
    ...existing,
    ...processedPatch,
    email: processedPatch.email ? processedPatch.email.toLowerCase() : existing.email,
    permissions:
      processedPatch.permissions !== undefined
        ? normalizePlatformAdminPermissions(processedPatch.permissions)
        : existing.permissions,
    sessionVersion: processedPatch.sessionVersion ?? existing.sessionVersion,
    disabledAt:
      processedPatch.disabledAt !== undefined ? processedPatch.disabledAt : existing.disabledAt,
  };

  if (next.role === "super_user") {
    next.permissions = FULL_PLATFORM_ADMIN_PERMISSIONS;
  }

  await activeDb().transaction(async (tx) => {
    const client = tx as unknown as ReturnType<typeof activeDb>;
    await client
      .update(platformUsers)
      .set({
        email: next.email,
        name: next.name,
        phone: next.phone ?? null,
        passwordHash: next.passwordHash,
        role: next.role,
        sessionVersion: next.sessionVersion,
        emailVerifiedAt: next.emailVerifiedAt ? new Date(next.emailVerifiedAt) : null,
        disabledAt: next.disabledAt ? new Date(next.disabledAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(platformUsers.id, userId));

    if (processedPatch.permissions !== undefined || processedPatch.role !== undefined) {
      await writePermissions(userId, next.permissions, client);
    }
  });

  return next;
}

export async function updatePlatformUserPermissions(
  userId: string,
  permissions: PlatformAdminPermissions,
): Promise<StoredPlatformUser | null> {
  return updatePlatformUserRow(userId, {
    permissions: normalizePlatformAdminPermissions(permissions),
  });
}

export async function deletePlatformUserRow(userId: string): Promise<boolean> {
  const existing = await findPlatformUserRowById(userId);
  if (!existing) return false;
  await activeDb().delete(platformUsers).where(eq(platformUsers.id, userId));
  return true;
}
