import { resolveTenantLoginEmail } from "@mms/shared";
import type { tenantUsers } from "../schema.js";
import type { TenantUserRow } from "./tenantUserRepositoryHydrate.js";

export const TABLE_AUTH_KEYS = new Set([
  "id",
  "workspaceSubdomain",
  "loginEmail",
  "passwordHash",
  "name",
  "role",
  "contactId",
  "emailVerifiedAt",
  "pendingLoginEmail",
  "createdAt",
  "email",
  "mustChangePassword",
  "deletedAt",
  "deletedBy",
]);

export function splitProfileFields(user: TenantUserRow): {
  columns: typeof tenantUsers.$inferInsert;
  profile: Record<string, unknown>;
} {
  const profile: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(user)) {
    if (!TABLE_AUTH_KEYS.has(key) && value !== undefined) {
      profile[key] = value;
    }
  }

  const loginEmail = resolveTenantLoginEmail(
    user,
    typeof user.email === "string" ? user.email : undefined,
  );
  const workspaceSubdomain =
    typeof user.workspaceSubdomain === "string" ? user.workspaceSubdomain.trim().toLowerCase() : "";

  return {
    columns: {
      id: String(user.id),
      workspaceSubdomain,
      loginEmail,
      passwordHash: typeof user.passwordHash === "string" ? user.passwordHash : "",
      name: typeof user.name === "string" ? user.name : "",
      role: typeof user.role === "string" ? user.role : "assistant_teacher",
      contactId: user.contactId != null && user.contactId !== "" ? String(user.contactId) : null,
      emailVerifiedAt:
        typeof user.emailVerifiedAt === "string" ? new Date(user.emailVerifiedAt) : null,
      pendingLoginEmail:
        typeof user.pendingLoginEmail === "string" ? user.pendingLoginEmail.toLowerCase() : null,
      createdAt: typeof user.createdAt === "string" ? new Date(user.createdAt) : new Date(),
      mustChangePassword: user.mustChangePassword === true,
      deletedAt:
        typeof user.deletedAt === "string" && user.deletedAt
          ? new Date(user.deletedAt)
          : user.deletedAt === null
            ? null
            : undefined,
      deletedBy:
        typeof user.deletedBy === "string" && user.deletedBy
          ? user.deletedBy
          : user.deletedBy === null
            ? null
            : undefined,
      profileJson: Object.keys(profile).length > 0 ? profile : null,
    },
    profile,
  };
}

export function omitUndefinedColumns<T extends Record<string, unknown>>(columns: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in columns) {
    if (Object.prototype.hasOwnProperty.call(columns, key)) {
      const val = columns[key];
      if (val !== undefined) {
        result[key] = val;
      }
    }
  }
  return result;
}

export function nonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "";
}
