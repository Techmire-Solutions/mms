import { TENANT_PATHS, TENANT_APP_PATHS } from "@/lib/routing/moduleRegistry";

/**
 * Central route path registry — single source of truth for URLs across the app.
 * Tenant app paths are derived from the module registry
 * (`@/lib/config/moduleRegistry`); platform/entry paths are declared here.
 */

export const ROUTES = {
  // Tenant app surface — derived from the module registry (SSOT).
  home: TENANT_PATHS.home,
  contacts: TENANT_PATHS.contacts,
  students: TENANT_PATHS.students,
  faculty: TENANT_PATHS.faculty,
  enrollments: TENANT_PATHS.enrollments,
  sessions: TENANT_PATHS.sessions,
  attendance: TENANT_PATHS.attendance,
  finance: TENANT_PATHS.finance,
  hasanatCards: TENANT_PATHS.hasanatCards,
  examinations: TENANT_PATHS.examinations,
  questionBank: TENANT_PATHS.questionBank,
  accounting: TENANT_PATHS.accounting,
  obligations: TENANT_PATHS.obligations,
  tasks: TENANT_PATHS.tasks,
  messaging: TENANT_PATHS.messaging,
  users: TENANT_PATHS.users,
  profile: TENANT_PATHS.profile,
  notifications: TENANT_PATHS.notifications,
  settings: TENANT_PATHS.settings,
  // Platform apex + auth entry paths.
  forcePasswordChange: "/force-password-change",
  institutionSetup: "/institution-setup",
  login: "/login",
  platformLogin: "/platform/login",
  forgotPassword: "/forgot-password",
  platformForgotPassword: "/platform/forgot-password",
  platformAccount: "/platform/account",
  platformAdmins: "/platform/admins",
  platformUsers: "/platform/users",
  platformSettings: "/platform/settings",
  platformDashboard: "/platform/dashboard",
  platformWorkspaces: "/platform/workspaces",
  platformReports: "/platform/reports",
  platformActivityLogs: "/platform/activity-logs",
  platformSystem: "/platform/system",
  platformErd: "/platform/erd",
  platformDesignSystem: "/platform/design-system",
  twoFactor: "/2fa",
  onboarding: "/onboarding",
  /** Apex-only: unknown tenant host redirected here with `?subdomain=` */
  tenantNotFound: "/tenant-not-found",
} as const;

/**
 * Platform apex paths reachable without a platform super-user session.
 * Dedicated platform sign-in at `/platform/login`; tenant module URLs show the workspace gate.
 */
export const PLATFORM_ENTRY_PATHS: readonly string[] = [
  ROUTES.home,
  ROUTES.login,
  ROUTES.platformLogin,
  ROUTES.forgotPassword,
  ROUTES.platformForgotPassword,
  ROUTES.twoFactor,
  ROUTES.tenantNotFound,
];

/** Apex path (+ query) for an unregistered tenant subdomain redirect. */
export function tenantNotFoundPath(subdomain: string): string {
  const params = new URLSearchParams({ subdomain });
  return `${ROUTES.tenantNotFound}?${params.toString()}`;
}

/**
 * Pre-authenticated entry routes — always English/LTR regardless of saved global language.
 * Tenant: login, forgot, 2FA. Apex: {@link PLATFORM_ENTRY_PATHS} plus workspace gate URLs.
 */
export const ENTRY_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.forgotPassword,
  ROUTES.platformForgotPassword,
  ROUTES.twoFactor,
];

/** True when pathname is an apex workspace-picker gate (tenant module URL on platform host). */
export function isPlatformWorkspaceGatePath(pathname: string): boolean {
  if (pathname === ROUTES.settings || pathname.startsWith(`${ROUTES.settings}/`)) {
    return true;
  }
  return isTenantAppPath(pathname);
}

/** True when unauthenticated users may view this path on the platform apex host. */
export function isPlatformEntryPath(pathname: string): boolean {
  if (
    PLATFORM_ENTRY_PATHS.some(
      (path) => pathname === path || (path !== ROUTES.home && pathname.startsWith(`${path}/`)),
    )
  ) {
    return true;
  }
  return isPlatformWorkspaceGatePath(pathname);
}

/**
 * Path-based English lock for **tenant auth entry** (login / 2FA / forgot).
 * Platform apex English is host-level via `shouldForcePlatformEnglish` — do not
 * overload this helper to cover the authenticated platform console.
 */
export function isEntryPath(pathname: string, options?: { isApex?: boolean }): boolean {
  if (options?.isApex) {
    return isPlatformEntryPath(pathname);
  }
  if (ENTRY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  if (pathname === ROUTES.onboarding) {
    return true;
  }
  return false;
}

/** App-wide settings sections only — module config lives in each module's Setup tab. */
export const SETTINGS_SECTIONS = [
  "global",
  "modules",
  "branding",
  "theme",
  "backup",
  "llm",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/** Active state for sidebar / nav links. */
export function isNavPathActive(pathname: string, itemPath: string): boolean {
  if (itemPath === ROUTES.home) {
    return pathname === ROUTES.home;
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/** Default post-login destination */
export const DEFAULT_AUTH_REDIRECT = ROUTES.home;

/** Tenant app module paths — not available on the apex host (from the registry). */
export { TENANT_APP_PATHS };

export function isTenantAppPath(pathname: string): boolean {
  return TENANT_APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
