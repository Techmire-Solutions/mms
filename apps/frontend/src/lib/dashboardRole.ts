import {
  STUDENTS_MODULE_MANIFEST,
  ATTENDANCE_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  USERS_MODULE_MANIFEST,
  DASHBOARD_MODULE_MANIFEST,
  type Permission,
  type DashboardRole,
  type AppTranslationKey,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export type { DashboardRole };

export const DASHBOARD_ROLE_GREETING_KEYS: Record<DashboardRole, AppTranslationKey> = {
  faculty: "dashboard.greeting.faculty",
  accountant: "dashboard.greeting.accountant",
  admin: "dashboard.greeting.admin",
};

export const DASHBOARD_ROLE_BADGE_KEYS: Record<DashboardRole, AppTranslationKey> = {
  faculty: "dashboard.badge.faculty",
  accountant: "dashboard.badge.accountant",
  admin: "dashboard.badge.admin",
};

/** Resolve the role-specific WelcomeBanner subtitle copy. Co-located with the
 *  greeting/badge key SSOT so all role→copy decisions live in one place. */
export function resolveDashboardWelcomeSubtitle(
  role: DashboardRole | string,
  counts: { activeSessionsCount: number; activeStudentCount: number },
  t: TranslationFunction,
): string {
  if (isDashboardFaculty(role)) {
    return counts.activeSessionsCount === 1
      ? t("dashboard.sessionsTodayOne")
      : t("dashboard.sessionsToday", { count: counts.activeSessionsCount });
  }
  if (isDashboardAdmin(role) && counts.activeStudentCount > 0) {
    return t("dashboard.overviewActiveStudents", { count: counts.activeStudentCount });
  }
  if (isDashboardAccountant(role)) {
    return t("dashboard.accountantOverview");
  }
  return t("dashboard.overview");
}

/** Resolve dashboard layout role from RBAC without inline `role ===` checks. */
export function resolveDashboardRole(can: (permission: Permission) => boolean): DashboardRole {
  if (
    can(USERS_MODULE_MANIFEST.permissions.write) ||
    can(DASHBOARD_MODULE_MANIFEST.permissions.setupWrite)
  ) {
    return "admin";
  }
  if (
    can(FINANCE_MODULE_MANIFEST.permissions.write) &&
    !can(ATTENDANCE_MODULE_MANIFEST.permissions.write)
  ) {
    return "accountant";
  }
  if (can(ATTENDANCE_MODULE_MANIFEST.permissions.write)) return "faculty";
  if (can(FINANCE_MODULE_MANIFEST.permissions.write)) return "accountant";
  // Least-privilege layout among existing role buckets (not admin).
  return "faculty";
}

/** Default initial widget scope based on viewer permissions. */
export function resolveDefaultDashboardWidgetScope(can: (permission: Permission) => boolean): {
  collection: "students" | "sessions" | "finance_invoices";
  category: string;
} {
  if (
    can(STUDENTS_MODULE_MANIFEST.permissions.write) ||
    can(USERS_MODULE_MANIFEST.permissions.write)
  ) {
    return { collection: "students", category: "students" };
  }
  if (can(ATTENDANCE_MODULE_MANIFEST.permissions.write)) {
    return { collection: "sessions", category: "sessions" };
  }
  return { collection: "finance_invoices", category: "financial" };
}

/** Whether a widget/card tagged for a role should render for the active viewer. */
export function widgetMatchesDashboardRole(
  widgetRole: string | undefined,
  dashboardRole: DashboardRole,
): boolean {
  if (!widgetRole) return dashboardRole === "admin";
  return widgetRole === dashboardRole;
}

/** Centralized role capability helpers for dashboard scope logic. */
export function isDashboardAdminOrAccountant(role: DashboardRole | string): boolean {
  return role === "admin" || role === "accountant";
}

export function isDashboardFaculty(role: DashboardRole | string): boolean {
  return role === "faculty";
}

export function isDashboardAdmin(role: DashboardRole | string): boolean {
  return role === "admin";
}

export function isDashboardAccountant(role: DashboardRole | string): boolean {
  return role === "accountant";
}
