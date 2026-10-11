import {
  resolveTenantLoginEmail,
  type ContactLike,
  type StoredTenantUser,
  type User,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import {
  listTenantUsersByWorkspace,
  type TenantUserRow,
} from "../../db/repositories/tenantUserRepository.js";
import { loadContactsByIds } from "../contactService.js";

/** Auth-capable user with credentials resolved for login and session. */
export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceSubdomain: string;
  passwordHash: string;
  createdAt: string;
  contactId?: string | number;
  loginEmail: string;
  emailVerifiedAt?: string;
  mustChangePassword?: boolean;
}

export type PublicUser = User;

/** Public user shape — no password hash. */
export type PersistedUser = StoredTenantUser & Record<string, unknown>;
export type IncomingUser = PersistedUser & { temporaryPassword?: string };

export function requireTenantSubdomain(): string {
  const tenant = getRequestTenant();
  if (!tenant) {
    throw new Error("Tenant context is required for workspace user operations");
  }
  return tenant.trim().toLowerCase();
}

export async function getContactsForUsers(users: PersistedUser[]): Promise<ContactLike[]> {
  const ids = [
    ...new Set(
      users
        .map((user) => user.contactId)
        .filter((id): id is string | number => id != null && id !== "")
        .map(String),
    ),
  ];
  if (ids.length === 0) return [];
  const raw = await loadContactsByIds(ids);
  return raw as ContactLike[];
}

export async function getRawUsers(options?: {
  includeDeleted?: boolean;
}): Promise<PersistedUser[]> {
  const subdomain = requireTenantSubdomain();
  const fromTable = await listTenantUsersByWorkspace(subdomain, {
    includeDeleted: options?.includeDeleted === true,
  });
  return fromTable as PersistedUser[];
}

export function hydratedEmail(user: PersistedUser): string {
  return typeof user.email === "string" ? user.email : "";
}

export function asAuthUser(user: PersistedUser): StoredUser | null {
  if (user.deletedAt) return null;
  const loginEmail = resolveTenantLoginEmail(user, hydratedEmail(user));
  const workspaceSubdomain =
    typeof user.workspaceSubdomain === "string" ? user.workspaceSubdomain.trim() : "";
  const passwordHash = typeof user.passwordHash === "string" ? user.passwordHash : "";
  if (!loginEmail || !workspaceSubdomain || !passwordHash) return null;

  return {
    id: user.id,
    email: loginEmail,
    loginEmail,
    name: typeof user.name === "string" ? user.name : "",
    role: typeof user.role === "string" ? user.role : "assistant_teacher",
    workspaceSubdomain,
    passwordHash,
    createdAt: typeof user.createdAt === "string" ? user.createdAt : new Date().toISOString(),
    contactId: user.contactId,
    emailVerifiedAt: typeof user.emailVerifiedAt === "string" ? user.emailVerifiedAt : undefined,
    mustChangePassword: user.mustChangePassword === true,
  };
}

export function toPublicUser(authUser: StoredUser): PublicUser {
  return {
    id: authUser.id,
    email: authUser.loginEmail,
    loginEmail: authUser.loginEmail,
    name: authUser.name,
    role: authUser.role,
    workspaceSubdomain: authUser.workspaceSubdomain,
    contactId: authUser.contactId,
    emailVerifiedAt: authUser.emailVerifiedAt,
    mustChangePassword: authUser.mustChangePassword === true,
  };
}

export type { TenantUserRow };
