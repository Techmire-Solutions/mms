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
});
