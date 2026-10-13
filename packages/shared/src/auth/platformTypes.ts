/** Global object key for apex platform super-users (not tenant-scoped). */
export const PLATFORM_SUPER_USERS_OBJECT_KEY = "platform_super_users";

/** Idle minutes before apex platform console auto sign-out. */
export const PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES = 30;

export type PlatformRole = "super_user" | "admin";

/** Grantable platform admin capabilities (super_user ignores and has all). */
export const PLATFORM_ADMIN_PERMISSION_KEYS = [
  "workspaces",
  "onboard",
  "settings",
  "admins",
  "system",
] as const;

/** Grantable platform admin capabilities (super_user ignores and has all). */
export type PlatformAdminPermissionKey = (typeof PLATFORM_ADMIN_PERMISSION_KEYS)[number];

/**
 * Per-admin capability flags assigned by a platform super-user.
 * `workspaces` — list / enable / disable / delete madrasas.
 * `onboard` — create new madrasas via onboarding.
 */
export interface PlatformAdminPermissions {
  workspaces: boolean;
  onboard: boolean;
  settings: boolean;
  admins: boolean;
  system: boolean;
}

/** Default for new admins — account self-service only until a super-user grants access. */
export const DEFAULT_PLATFORM_ADMIN_PERMISSIONS: PlatformAdminPermissions = {
  workspaces: false,
  onboard: false,
  settings: false,
  admins: false,
  system: false,
};

/** Full grants used for super_user rows / JWT hydration convenience. */
export const FULL_PLATFORM_ADMIN_PERMISSIONS: PlatformAdminPermissions = {
  workspaces: true,
  onboard: true,
  settings: true,
  admins: true,
  system: true,
};

/** Public platform operator — separate from tenant `User`. */
export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  /** E.164 — only source of a real number for platform SMS 2FA; optional until the admin sets it. */
  phone?: string;
  role: PlatformRole;
  permissions: PlatformAdminPermissions;
}

/** Platform super-user profile returned from `/api/platform/auth/me`. */
export interface PlatformUserProfile extends PlatformUser {
  createdAt?: string;
  emailVerifiedAt?: string;
  /** ISO timestamp when a super-user disabled this admin; omitted/null when active. */
  disabledAt?: string | null;
}

export interface StoredPlatformUser extends PlatformUser {
  passwordHash: string;
  /** Incremented on password change/reset to invalidate existing platform JWTs. */
  sessionVersion: number;
  createdAt: string;
  emailVerifiedAt?: string;
  /** Soft-disable — login and platform sessions rejected while set. */
  disabledAt?: string | null;
}

/**
 * Whether a platform operator may perform a grantable capability.
 * Super-users always can; admins use their stored permission flags.
 */
export function platformUserCan(
  user: Pick<PlatformUser, "role" | "permissions"> | null | undefined,
  permission: PlatformAdminPermissionKey,
): boolean {
  if (!user) return false;
  if (user.role === "super_user") return true;
  return Boolean(user.permissions?.[permission]);
}

/** Normalize partial/unknown JSON into a full permissions object. */
export function normalizePlatformAdminPermissions(value: unknown): PlatformAdminPermissions {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PLATFORM_ADMIN_PERMISSIONS };
  }
  const record = value as Record<string, unknown>;
  return {
    workspaces: record.workspaces === true,
    onboard: record.onboard === true,
    settings: record.settings === true,
    admins: record.admins === true,
    system: record.system === true,
  };
}

/** Public setup status for apex first-run wizard. */
export interface PlatformSetupStatus {
  needsSetup: boolean;
  smtpConfigured: boolean;
}

export interface PlatformSetupRegisterResult {
  user?: PlatformUser;
  setupId?: string;
  email?: string;
  emailSent?: boolean;
  /** Dev-only OTP when SMTP is not configured. */
  devCode?: string;
}

export const PLATFORM_SETUP_CODE_TTL_MINUTES = 15;

export const PLATFORM_PASSWORD_RESET_TTL_MINUTES = 15;

/** Max failed OTP verifies per setup/reset artifact before the session is invalidated. */
export const PLATFORM_OTP_MAX_ATTEMPTS = 5;

export const PLATFORM_MIN_PASSWORD_LENGTH = 10;

export interface PlatformPasswordForgotResult {
  accepted: true;
  /** Non-production hint when platform SMTP is not configured. */
  devReset?: {
    resetId: string;
    code: string;
  };
}
