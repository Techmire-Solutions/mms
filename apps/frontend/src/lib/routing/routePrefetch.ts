import { ROUTES } from "@/lib/config/routes";
import { isCurrentHostApex } from "@/lib/config/tenantConfig";

const TENANT_ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  [ROUTES.home]: () => import("@/tenant/features/dashboard/DashboardPage"),
  [ROUTES.contacts]: () => import("@/tenant/features/contacts/ContactsPage"),
  [ROUTES.messaging]: () => import("@/tenant/features/messaging/MessagingPage"),
  [ROUTES.students]: () => import("@/tenant/features/students/StudentsPage"),
  [ROUTES.faculty]: () => import("@/tenant/features/faculty/FacultyPage"),
  [ROUTES.enrollments]: () => import("@/tenant/features/enrollments/EnrollmentsPage"),
  [ROUTES.sessions]: () => import("@/tenant/features/sessions/SessionsPage"),
  [ROUTES.attendance]: () => import("@/tenant/features/attendance/AttendancePage"),
  [ROUTES.finance]: () => import("@/tenant/features/finance/FinancePage"),
  [ROUTES.hasanatCards]: () => import("@/tenant/features/hasanat/HasanatCardsPage"),
  [ROUTES.examinations]: () => import("@/tenant/features/examinations/ExaminationsPage"),
  [ROUTES.questionBank]: () => import("@/tenant/features/question-bank/QuestionBankPage"),
  [ROUTES.accounting]: () => import("@/tenant/features/accounting/AccountingPage"),
  [ROUTES.obligations]: () => import("@/tenant/features/obligations/ObligationsPage"),
  [ROUTES.users]: () => import("@/tenant/features/users/UsersPage"),
  [ROUTES.settings]: () => import("@/tenant/features/settings/SettingsPage"),
};

const APEX_ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  [ROUTES.home]: () => import("@/platform/pages/ApexHome"),
  [ROUTES.tenantNotFound]: () => import("@/platform/pages/TenantNotFoundPage"),
  [ROUTES.onboarding]: () => import("@/platform/pages/onboarding/OnboardingWizard"),
  [ROUTES.platformAccount]: () => import("@/platform/pages/PlatformAccount"),
  [ROUTES.platformForgotPassword]: () => import("@/platform/pages/auth/PlatformForgotPassword"),
};

const prefetched = new Set<string>();

function loadersForCurrentHost(): Record<string, () => Promise<unknown>> {
  return isCurrentHostApex() ? APEX_ROUTE_LOADERS : TENANT_ROUTE_LOADERS;
}

/** Warm the JS chunk for a route path (idempotent, host-aware). */
export function prefetchRoute(path: string): void {
  const loader = loadersForCurrentHost()[path];
  if (!loader || prefetched.has(path)) {
    return;
  }
  prefetched.add(path);
  void loader();
}
