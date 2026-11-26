import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TenantModuleHostBridges } from "./TenantModuleHostBridges";
import { useContactsHost } from "@mms/mod-contacts/frontend/tenant/host";
import { useFacultyHost } from "@mms/mod-faculty/frontend/tenant/host";
import { useFinanceHostValue } from "@mms/mod-billing/frontend/tenant/host";
import { useHasanatHost } from "@mms/mod-hasanat/frontend/tenant/host";
import { useMessagingHost } from "@mms/mod-messaging/frontend/tenant/host";
import { getStudentsHost } from "@mms/mod-students/frontend/tenant/host";
import { getSessionsHost } from "@mms/mod-sessions/frontend/tenant/host";
import { getEnrollmentsHost } from "@mms/mod-enrollments/frontend/tenant/host";
import { getAttendanceHost } from "@mms/mod-attendance/frontend/tenant/host";
import { getTasksHost } from "@mms/mod-tasks/frontend/tenant/host";
import { useEnrollmentsCollection as useSessionsEnrollmentsCollection } from "@mms/mod-sessions/frontend/tenant/host/enrollmentsCollection";
import { useEnrollmentsCollection as useAttendanceEnrollmentsCollection } from "@mms/mod-attendance/frontend/tenant/host/enrollmentsCollection";
import { useSessionsCollection as useAttendanceSessionsCollection } from "@mms/mod-attendance/frontend/tenant/host/sessionsCollection";
import { ReportChartCard as AttendanceReportChartCard } from "@mms/mod-attendance/frontend/tenant/host/ModuleReportsTier";
import { useSessionsCollection as useBillingSessionsCollection } from "@mms/mod-billing/frontend/tenant/host/sessionsCollection";
import { useSessionsCollection as useEnrollmentsSessionsCollection } from "@mms/mod-enrollments/frontend/tenant/host/sessionsCollection";
import { useSessionsCollection as useStudentsSessionsCollection } from "@mms/mod-students/frontend/tenant/host/sessionsCollection";
import { useEnrollmentsCollection as useStudentsEnrollmentsCollection } from "@mms/mod-students/frontend/tenant/host/enrollmentsCollection";
import { ReportChartCard as TasksReportChartCard } from "@mms/mod-tasks/frontend/tenant/host/ModuleReportsTier";
import { usePermissions } from "@/tenant/hooks/usePermissions";

vi.mock("@mms/fe-core/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/tenant")>();
  return {
    ...actual,
    useTenant: () => ({
      subdomain: "test",
      workspace: { madrasaName: "Test", subdomain: "test", enabled: true },
      workspaceLoading: false,
    }),
  };
});

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, dir: "ltr", language: "en" }),
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "admin", workspaceSubdomain: "test" },
    isAuthenticated: true,
    authChecked: true,
  }),
  useOptionalAuth: () => null,
}));

function HostProbe() {
  const contacts = useContactsHost();
  const faculty = useFacultyHost();
  const finance = useFinanceHostValue();
  const hasanat = useHasanatHost();
  const messaging = useMessagingHost();
  const students = getStudentsHost();
  const sessions = getSessionsHost();
  const enrollments = getEnrollmentsHost();
  const attendance = getAttendanceHost();
  const tasks = getTasksHost();
  return (
    <div data-testid="probe">
      {[
        Boolean(contacts),
        Boolean(faculty),
        Boolean(finance),
        Boolean(hasanat),
        Boolean(messaging),
        Boolean(students),
        Boolean(sessions),
        Boolean(enrollments),
        attendance.usePermissions === usePermissions,
        tasks.usePermissions === usePermissions,
      ].every(Boolean)
        ? "ALL_HOSTS_READY"
        : "MISSING_HOST"}
    </div>
  );
}

describe("TenantModuleHostBridges", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it("mounts all 10 vertical module hosts so child pages resolve every host context and singleton", () => {
    const qc = new QueryClient();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TenantModuleHostBridges>
              <HostProbe />
            </TenantModuleHostBridges>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    expect(container.textContent).toContain("ALL_HOSTS_READY");
  });

  it("given mounted TenantModuleHostBridges, should delegate collection shims to arrays and report cards to host components when rendered", () => {
    // Arrange
    function CollectionAndReportProbe() {
      const sessionsEnrollments = useSessionsEnrollmentsCollection({
        enabled: false,
        sessionId: "s-1",
      });
      const attendanceEnrollments = useAttendanceEnrollmentsCollection({ enabled: false });
      const attendanceSessions = useAttendanceSessionsCollection({ enabled: false });
      const billingSessions = useBillingSessionsCollection({ enabled: false });
      const enrollmentsSessions = useEnrollmentsSessionsCollection({ enabled: false });
      const studentsSessions = useStudentsSessionsCollection({ enabled: false });
      const studentsEnrollments = useStudentsEnrollmentsCollection({ enabled: false });
      const allArrays = [
        sessionsEnrollments,
        attendanceEnrollments,
        attendanceSessions,
        billingSessions,
        enrollmentsSessions,
        studentsSessions,
        studentsEnrollments,
      ].every((collection) => Array.isArray(collection));

      return (
        <div>
          <span>{allArrays ? "COLLECTIONS_ARE_ARRAYS" : "BROKEN_COLLECTION_SHIM"}</span>
          <AttendanceReportChartCard title="Attendance Chart Title">
            <span>attendance-body</span>
          </AttendanceReportChartCard>
          <TasksReportChartCard title="Tasks Chart Title">
            <span>tasks-body</span>
          </TasksReportChartCard>
        </div>
      );
    }

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Act
    act(() => {
      root!.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <TenantModuleHostBridges>
              <CollectionAndReportProbe />
            </TenantModuleHostBridges>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    // Assert
    expect(container.textContent).toContain("COLLECTIONS_ARE_ARRAYS");
    expect(container.textContent).toContain("Attendance Chart Title");
    expect(container.textContent).toContain("Tasks Chart Title");
  });

  it("evaluates module imports cleanly under production mode before host bridges render", async () => {
    vi.resetModules();
    vi.stubEnv("MODE", "production");
    try {
      await expect(import("./TenantModuleHostBridges")).resolves.toHaveProperty(
        "TenantModuleHostBridges",
      );
      await expect(import("@mms/mod-attendance/frontend/tenant")).resolves.toHaveProperty(
        "AttendancePage",
      );
      await expect(
        import("@mms/mod-attendance/frontend/tenant/hooks/index"),
      ).resolves.toHaveProperty("useAttendancePageController");
      await expect(import("@mms/mod-tasks/frontend/tenant")).resolves.toHaveProperty("TasksPage");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("renders TasksPage and AttendancePage under TenantModuleHostBridges without hitting ErrorBoundary", async () => {
    const [{ TenantModuleHostBridges: FreshHostBridges }, { TasksPage }, { AttendancePage }] =
      await Promise.all([
        import("./TenantModuleHostBridges"),
        import("@mms/mod-tasks/frontend/tenant"),
        import("@mms/mod-attendance/frontend/tenant"),
      ]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <FreshHostBridges>
              <TasksPage />
              <AttendancePage />
            </FreshHostBridges>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).not.toContain("Something went wrong");
    expect(container.textContent).not.toContain("Application error");
    expect(container.querySelectorAll("h1").length).toBeGreaterThanOrEqual(2);
  });
});
