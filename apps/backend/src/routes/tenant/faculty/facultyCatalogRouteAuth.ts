import { FACULTY_MODULE_MANIFEST, roleHasPermission, type User } from "@mms/shared";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { FacultyCatalogConflictError } from "../../../faculty/errors.js";

export type CatalogForbidden = { status: 403; body: { type: "forbidden"; message: string } };
export type CatalogAuth = { user: User; tenantId: string };

/** Resolves the acting user + tenant, or a 403 response when the gate fails. */
export function authorizeCatalogRoute(
  request: ContractRouteArgs<unknown>["request"],
  check: (user: User) => boolean,
): CatalogAuth | CatalogForbidden {
  const user = request.user as User;
  if (!check(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const tenantId = request.tenant?.id;
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  return { user, tenantId: String(tenantId) };
}

export const canReadFacultyCatalog = (user: User) => canReadCollection(user, "faculty");
export const canManageFacultySetup = (user: User) =>
  canWriteCollection(user, "faculty") &&
  roleHasPermission(user.role, FACULTY_MODULE_MANIFEST.permissions.setupWrite);
export const canArchiveFacultySetup = (user: User) =>
  canDeleteCollection(user, "faculty") &&
  roleHasPermission(user.role, FACULTY_MODULE_MANIFEST.permissions.setupWrite);

/** True when the error is a catalog uniqueness / dependency conflict (HTTP 409). */
export function isCatalogConflict(error: unknown): boolean {
  if (error instanceof FacultyCatalogConflictError) return true;
  const message = error instanceof Error ? error.message : "";
  return message.includes("duplicate key") || message.includes("unique");
}
