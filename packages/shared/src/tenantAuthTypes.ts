import type { Contact } from "./contactTypes.js";

/** Auth-owned fields on a workspace user row (never stripped by contact-first normalize). */
export interface TenantAuthFields {
  /** Canonical sign-in identifier — not the CRM contact email. */
  loginEmail: string;
  /** ISO timestamp when `loginEmail` was last verified. */
  emailVerifiedAt?: string;
  /** True until the user changes an admin-issued temporary password. */
  mustChangePassword?: boolean;
}

/** Shared User interface used across frontend and backend. */
export interface User {
  id: string;
  /** Sign-in email (`loginEmail`); kept as `email` for JWT backward compatibility. */
  email: string;
  name: string;
  role: string;
  /** Madrasa subdomain this account belongs to. */
  workspaceSubdomain: string;
  /** Linked CRM contact for profile fields. */
  contactId?: string | number;
  loginEmail?: string;
  emailVerifiedAt?: string;
  /** Forces the user through password change before normal workspace access. */
  mustChangePassword?: boolean;
}

/** Persisted tenant user with optional auth credentials. */
export interface StoredTenantUser extends Partial<TenantAuthFields> {
  id: string;
  contactId?: string | number;
  role?: string;
  workspaceSubdomain?: string;
  passwordHash?: string;
  createdAt?: string;
  /** Legacy / hydrated display — not used for login when `loginEmail` is set. */
  email?: string;
  name?: string;
  pendingLoginEmail?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

/** Resolves the canonical login email from persisted auth + optional hydrated contact email. */
export function resolveTenantLoginEmail(
  user: Partial<StoredTenantUser>,
  hydratedEmail?: string,
): string {
  const fromAuth = user.loginEmail?.trim() || user.email?.trim();
  if (fromAuth) return fromAuth.toLowerCase();
  if (hydratedEmail?.trim()) return hydratedEmail.trim().toLowerCase();
  return "";
}

/** Session + profile payload for tenant account page. */
export interface TenantUserProfile {
  id: string;
  loginEmail: string;
  emailVerifiedAt?: string;
  name: string;
  role: string;
  workspaceSubdomain: string;
  contactId?: string | number;
  contact: Contact | null;
  pendingLoginEmail?: string;
}

/**
 * Canonical tenant authentication API error types.
 * Single source of truth across frontend error mappers and backend login routes.
 */
export const TENANT_AUTH_ERROR_TYPES = [
  "invalid_credentials",
  "auth_required",
  "connection_error",
  "user_not_registered",
  "workspace_disabled",
  "email_not_verified",
  "validation_error",
  "rate_limit_exceeded",
] as const;

export type TenantAuthErrorType = (typeof TENANT_AUTH_ERROR_TYPES)[number];
