/**
 * @file userPermissionContext.ts
 * @description Per-request tenant role catalog attached to the authenticated user.
 *
 * The catalog lives in a WeakMap rather than on the user object so it can never
 * leak through `/auth/me`, JSON logs or spread copies. Permission helpers read
 * it through `userHasPermission`, which falls back to the default system-role
 * map when the catalog is absent.
 */
import { roleHasPermission, type Permission, type User, type WorkspaceRole } from "@mms/shared";

const catalogs = new WeakMap<User, readonly WorkspaceRole[]>();

export function setUserRoleCatalog(user: User, roles: readonly WorkspaceRole[]): void {
  if (user && typeof user === "object") catalogs.set(user, roles);
}

export function getUserRoleCatalog(user: User | undefined): readonly WorkspaceRole[] | undefined {
  return user && typeof user === "object" ? catalogs.get(user) : undefined;
}

/**
 * Evaluates a permission with the workspace role catalog when one was attached
 * during authentication. System roles keep using the default role map.
 */
export function userHasPermission(user: User | undefined, permission: Permission): boolean {
  if (!user?.role) return false;
  return roleHasPermission(user.role, permission, getUserRoleCatalog(user));
}
