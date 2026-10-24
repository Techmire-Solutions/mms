import { asc, count, eq, inArray } from "drizzle-orm";
import {
  type StoredPlatformUser,
  type PlatformRole,
  type PlatformAdminPermissions,
  type PlatformAdminPermissionKey,
  PLATFORM_ADMIN_PERMISSION_KEYS,
  normalizePlatformAdminPermissions,
  FULL_PLATFORM_ADMIN_PERMISSIONS,
} from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { platformUsers, platformUserPermissions } from "../schema.js";

export const PERMISSION_KEYS: PlatformAdminPermissionKey[] = [...PLATFORM_ADMIN_PERMISSION_KEYS];

export async function loadPermissions(userId: string): Promise<PlatformAdminPermissions> {
  const rows = await activeDb()
    .select({
      permissionKey: platformUserPermissions.permissionKey,
      isGranted: platformUserPermissions.isGranted,
    })
    .from(platformUserPermissions)
    .where(eq(platformUserPermissions.platformUserId, userId));

  const perms: Record<string, boolean> = {};
  for (const row of rows) {
    perms[row.permissionKey] = row.isGranted;
  }
  return normalizePlatformAdminPermissions(perms);
}

export async function loadPermissionsForUsers(
  userIds: string[],
): Promise<Map<string, PlatformAdminPermissions>> {
  const map = new Map<string, PlatformAdminPermissions>();
  if (userIds.length === 0) return map;

  const rows = await activeDb()
    .select({
      userId: platformUserPermissions.platformUserId,
      permissionKey: platformUserPermissions.permissionKey,
      isGranted: platformUserPermissions.isGranted,
    })
    .from(platformUserPermissions)
    .where(inArray(platformUserPermissions.platformUserId, userIds));

  const perUserRaw: Record<string, Record<string, boolean>> = {};
  for (const row of rows) {
    if (!perUserRaw[row.userId]) perUserRaw[row.userId] = {};
    perUserRaw[row.userId][row.permissionKey] = row.isGranted;
  }

  for (const id of userIds) {
    map.set(id, normalizePlatformAdminPermissions(perUserRaw[id] ?? {}));
  }
  return map;
}

export function rowToStored(
  row: typeof platformUsers.$inferSelect,
  permissions: PlatformAdminPermissions,
): StoredPlatformUser {
  const role = row.role as PlatformRole;
  const effectivePerms = role === "super_user" ? FULL_PLATFORM_ADMIN_PERMISSIONS : permissions;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone ?? undefined,
    passwordHash: row.passwordHash,
    role,
    permissions: effectivePerms,
    sessionVersion: row.sessionVersion ?? 0,
    createdAt: row.createdAt.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString(),
    disabledAt: row.disabledAt?.toISOString() ?? null,
  };
}

export async function countPlatformUserRows(): Promise<number> {
  const rows = await activeDb().select({ value: count() }).from(platformUsers);
  return Number(rows[0]?.value ?? 0);
}

export async function listPlatformUsers(): Promise<StoredPlatformUser[]> {
  const rows = await activeDb()
    .select({
      id: platformUsers.id,
      email: platformUsers.email,
      name: platformUsers.name,
      phone: platformUsers.phone,
      role: platformUsers.role,
      sessionVersion: platformUsers.sessionVersion,
      createdAt: platformUsers.createdAt,
      updatedAt: platformUsers.updatedAt,
      emailVerifiedAt: platformUsers.emailVerifiedAt,
      disabledAt: platformUsers.disabledAt,
    })
    .from(platformUsers)
    .orderBy(asc(platformUsers.createdAt));
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.id);
  const permsMap = await loadPermissionsForUsers(userIds);

  return rows.map((row) =>
    rowToStored(
      { ...row, passwordHash: "" },
      permsMap.get(row.id) ?? normalizePlatformAdminPermissions({}),
    ),
  );
}

export async function findPlatformUserRowByEmail(
  email: string,
): Promise<StoredPlatformUser | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await activeDb()
    .select({
      id: platformUsers.id,
      email: platformUsers.email,
      name: platformUsers.name,
      phone: platformUsers.phone,
      passwordHash: platformUsers.passwordHash,
      role: platformUsers.role,
      sessionVersion: platformUsers.sessionVersion,
      createdAt: platformUsers.createdAt,
      updatedAt: platformUsers.updatedAt,
      emailVerifiedAt: platformUsers.emailVerifiedAt,
      disabledAt: platformUsers.disabledAt,
    })
    .from(platformUsers)
    .where(eq(platformUsers.email, normalized))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const perms = await loadPermissions(row.id);
  return rowToStored(row, perms);
}

export async function findPlatformUserRowById(id: string): Promise<StoredPlatformUser | null> {
  const rows = await activeDb()
    .select({
      id: platformUsers.id,
      email: platformUsers.email,
      name: platformUsers.name,
      phone: platformUsers.phone,
      passwordHash: platformUsers.passwordHash,
      role: platformUsers.role,
      sessionVersion: platformUsers.sessionVersion,
      createdAt: platformUsers.createdAt,
      updatedAt: platformUsers.updatedAt,
      emailVerifiedAt: platformUsers.emailVerifiedAt,
      disabledAt: platformUsers.disabledAt,
    })
    .from(platformUsers)
    .where(eq(platformUsers.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const perms = await loadPermissions(row.id);
  return rowToStored(row, perms);
}

export async function findPlatformUserRowByRole(
  role: PlatformRole,
): Promise<StoredPlatformUser | null> {
  const rows = await activeDb()
    .select({
      id: platformUsers.id,
      email: platformUsers.email,
      name: platformUsers.name,
      phone: platformUsers.phone,
      passwordHash: platformUsers.passwordHash,
      role: platformUsers.role,
      sessionVersion: platformUsers.sessionVersion,
      createdAt: platformUsers.createdAt,
      updatedAt: platformUsers.updatedAt,
      emailVerifiedAt: platformUsers.emailVerifiedAt,
      disabledAt: platformUsers.disabledAt,
    })
    .from(platformUsers)
    .where(eq(platformUsers.role, role))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const perms = await loadPermissions(row.id);
  return rowToStored(row, perms);
}
