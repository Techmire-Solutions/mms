import React from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useTenant } from "@/lib/contexts/TenantContext";
import { ROUTES, tenantNotFoundPath } from "@/lib/config/routes";
import { apexUrl } from "@/lib/config/tenantConfig";
import ProtectedRoute from "@/tenant/components/guards/ProtectedRoute";
import GuestRoute from "@/tenant/components/guards/GuestRoute";
import ModuleAccessRoute from "@/tenant/components/guards/ModuleAccessRoute";
import WorkspaceDisabledScreen from "@/tenant/components/WorkspaceDisabledScreen";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { AuthPageFrame } from "@/components/entry";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";

const AppLayout = React.lazy(() => import("@/tenant/components/layout/AppLayout"));
const PageNotFound = React.lazy(() => import("@/tenant/components/PageNotFound"));

const Dashboard = React.lazy(() => import("@/tenant/features/dashboard/DashboardPage"));
const Contacts = React.lazy(() => import("@/tenant/features/contacts/ContactsPage"));
const Students = React.lazy(() => import("@/tenant/features/students/StudentsPage"));
const Faculty = React.lazy(() => import("@/tenant/features/faculty/FacultyPage"));
const Enrollments = React.lazy(() => import("@/tenant/features/enrollments/EnrollmentsPage"));
const Sessions = React.lazy(() => import("@/tenant/features/sessions/SessionsPage"));
const Finance = React.lazy(() => import("@/tenant/features/finance/FinancePage"));
const HasanatCards = React.lazy(() => import("@/tenant/features/hasanat/HasanatCardsPage"));
const Examinations = React.lazy(() => import("@/tenant/features/examinations/ExaminationsPage"));
const QuestionBankPage = React.lazy(
  () => import("@/tenant/features/question-bank/QuestionBankPage"),
);
const SettingsPage = React.lazy(() => import("@/tenant/features/settings/SettingsPage"));
const Attendance = React.lazy(() => import("@/tenant/features/attendance/AttendancePage"));
const Users = React.lazy(() => import("@/tenant/features/users/UsersPage"));
const AccountProfile = React.lazy(() => import("@/tenant/features/profile/AccountProfilePage"));
const Obligations = React.lazy(() => import("@/tenant/features/obligations/ObligationsPage"));
const Tasks = React.lazy(() => import("@/tenant/features/tasks/TasksPage"));
const Notifications = React.lazy(() => import("@/tenant/features/notifications/NotificationsPage"));
const Accounting = React.lazy(() => import("@/tenant/features/accounting/AccountingPage"));
const Login = React.lazy(() => import("@/tenant/pages/auth/Login"));
const ForgotPassword = React.lazy(() => import("@/tenant/pages/auth/ForgotPassword"));
const TwoFactorAuth = React.lazy(() => import("@/tenant/pages/auth/TwoFactorAuth"));
const ForcePasswordChange = React.lazy(() => import("@/tenant/pages/auth/ForcePasswordChange"));
const InstitutionSetup = React.lazy(() => import("@/tenant/pages/setup/InstitutionSetup"));
const Messaging = React.lazy(() => import("@/tenant/features/messaging/MessagingPage"));

function RedirectToApex({ path }: { path: string }): React.JSX.Element {
  React.useEffect(() => {
    window.location.href = apexUrl(path);
  }, [path]);

  return <RouteStatusFallback fullScreen />;
}

/**
 * Blocks all tenant app routes (including `/settings`) when the host subdomain
 * has no registered workspace. Hard-redirects to the apex platform
 * `/tenant-not-found?subdomain=` page — never leave the browser on the bad host.
 */
function TenantBootGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation();
  const {
    workspaceLoading,
    workspaceMissing,
    workspaceLookupFailed,
    workspace,
    subdomain,
    refetchWorkspace,
  } = useTenant();
  const location = useLocation();

  if (workspaceLoading) {
    return <RouteStatusFallback fullScreen />;
  }

  if (workspaceMissing && subdomain) {
    return <RedirectToApex path={tenantNotFoundPath(subdomain)} />;
  }

  if (workspaceLookupFailed) {
    return (
      <AuthPageFrame dir="ltr">
        <div className="relative z-elevated mx-auto w-full max-w-md">
          <ErrorState
            type="network"
            title={t("errors.boundary.title")}
            description={t("errors.boundary.description")}
            onRetry={refetchWorkspace}
          />
        </div>
      </AuthPageFrame>
    );
  }

  if (workspace && workspace.enabled === false) {
    if (location.pathname !== ROUTES.home) {
      return <Navigate to={ROUTES.home} replace />;
    }
    return (
      <WorkspaceDisabledScreen
        madrasaName={workspace.madrasaName}
        subdomain={workspace.subdomain}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Tenant madrasa route tree — login, dashboard, and module pages on {slug}.{domain}.
 */
function TenantRoutesInner(): React.JSX.Element {
  return (
    <TenantBootGate>
      <Routes>
        <Route path={ROUTES.onboarding} element={<RedirectToApex path={ROUTES.onboarding} />} />

        <Route
          path={ROUTES.twoFactor}
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <TwoFactorAuth />
            </React.Suspense>
          }
        />
        <Route element={<GuestRoute />}>
          <Route
            path={ROUTES.login}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <Login />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.forgotPassword}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <ForgotPassword />
              </React.Suspense>
            }
          />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route
            path={ROUTES.forcePasswordChange}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <ForcePasswordChange />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.institutionSetup}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <InstitutionSetup />
              </React.Suspense>
            }
          />
          <Route
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <AppLayout />
              </React.Suspense>
            }
          >
            <Route element={<ModuleAccessRoute />}>
              <Route
                path={ROUTES.home}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Dashboard />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.contacts}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Contacts />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.messaging}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Messaging />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.students}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Students />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.faculty}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Faculty />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.enrollments}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Enrollments />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.sessions}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Sessions />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.attendance}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Attendance />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.finance}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Finance />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.hasanatCards}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <HasanatCards />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.examinations}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Examinations />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.questionBank}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <QuestionBankPage />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.accounting}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Accounting />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.obligations}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Obligations />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.tasks}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Tasks />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.users}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Users />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.profile}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <AccountProfile />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.notifications}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <Notifications />
                  </React.Suspense>
                }
              />
              <Route
                path={ROUTES.settings}
                element={
                  <React.Suspense fallback={<RouteStatusFallback />}>
                    <SettingsPage />
                  </React.Suspense>
                }
              />
              <Route
                path={`${ROUTES.settings}/:section`}
                element={<Navigate to={ROUTES.settings} replace />}
              />
            </Route>
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PageNotFound />
            </React.Suspense>
          }
        />
      </Routes>
    </TenantBootGate>
  );
}

import TenantScopedProviders from "@/providers/TenantScopedProviders";

export default function TenantRoutes(): React.JSX.Element {
  return (
    <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
      <TenantScopedProviders>
        <TenantRoutesInner />
      </TenantScopedProviders>
    </React.Suspense>
  );
}
