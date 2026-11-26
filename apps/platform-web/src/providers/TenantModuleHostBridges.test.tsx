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
import { useEnrollmentsCollection as useSessionsEnrollmentsCollection } from "@mms/mod-sessions/frontend/tenant/host/enrollmentsCollection";
import { useSessionsCollection as useBillingSessionsCollection } from "@mms/mod-billing/frontend/tenant/host/sessionsCollection";
import { useSessionsCollection as useEnrollmentsSessionsCollection } from "@mms/mod-enrollments/frontend/tenant/host/sessionsCollection";
import { useSessionsCollection as useStudentsSessionsCollection } from "@mms/mod-students/frontend/tenant/host/sessionsCollection";
import { useEnrollmentsCollection as useStudentsEnrollmentsCollection } from "@mms/mod-students/frontend/tenant/host/enrollmentsCollection";

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

  it("mounts all 8 vertical module hosts so child pages resolve every host context and singleton", () => {
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

  it("given mounted platform TenantModuleHostBridges, should return arrays from all cross-module collection shims when invoked", () => {
    // Arrange
    function CollectionProbe() {
      const allArrays = [
        useSessionsEnrollmentsCollection({ enabled: false }),
        useBillingSessionsCollection({ enabled: false }),
        useEnrollmentsSessionsCollection({ enabled: false }),
        useStudentsSessionsCollection({ enabled: false }),
        useStudentsEnrollmentsCollection({ enabled: false }),
      ].every((collection) => Array.isArray(collection));
      return <div>{allArrays ? "COLLECTIONS_ARE_ARRAYS" : "BROKEN_COLLECTION_SHIM"}</div>;
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
              <CollectionProbe />
            </TenantModuleHostBridges>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    // Assert
    expect(container.textContent).toContain("COLLECTIONS_ARE_ARRAYS");
  });
});
