import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  buildModuleAvailability,
  evaluateModuleAccess,
  roleHasPermission,
  type ModuleAvailabilityMap,
} from "@mms/shared";
import type { ModuleAccessState } from "@/tenant/hooks/useModuleAccess";

const { mockUseModuleAccess } = vi.hoisted(() => ({ mockUseModuleAccess: vi.fn() }));

vi.mock("@/tenant/hooks/useModuleAccess", () => ({ useModuleAccess: () => mockUseModuleAccess() }));
vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/routing/RouteStatusFallback", () => ({
  default: () => <div>Checking access</div>,
}));

import ModuleAccessRoute from "./ModuleAccessRoute";

function accessState(
  availability: ModuleAvailabilityMap | null,
  role: string,
  status: ModuleAccessState["status"] = "ready",
  retry = vi.fn(),
): ModuleAccessState {
  const can = (p: Parameters<typeof roleHasPermission>[1]) => roleHasPermission(role, p);
  return {
    status,
    availability,
    effectiveModules: {},
    evaluate: (moduleId, action) => evaluateModuleAccess({ moduleId, availability, can, action }),
    canManageModules: can("settings.global.write"),
    retry,
  };
}

describe("ModuleAccessRoute", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function renderAt(path: string): Promise<void> {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<ModuleAccessRoute />}>
              <Route path="/finance/*" element={<div>Finance page</div>} />
              <Route path="/faculty" element={<div>Faculty page</div>} />
              <Route path="/profile" element={<div>Profile page</div>} />
              <Route path="/" element={<div>Home page</div>} />
            </Route>
            <Route path="/settings" element={<div>Settings page</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  it("given access is still loading, should not render the module page or start its requests", async () => {
    mockUseModuleAccess.mockReturnValue(accessState(null, "admin", "pending"));

    await renderAt("/finance");

    expect(container.textContent).toContain("Checking access");
    expect(container.textContent).not.toContain("Finance page");
  });

  it("given the access check failed, should deny and offer a retry", async () => {
    const retry = vi.fn();
    mockUseModuleAccess.mockReturnValue(accessState(null, "admin", "error", retry));

    await renderAt("/finance");
    await act(async () => container.querySelector("button")?.click());

    expect(container.textContent).toContain("errors.route.accessCheckFailedTitle");
    expect(container.textContent).not.toContain("Finance page");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("given the platform has not granted the module, should show unavailable without a settings link", async () => {
    mockUseModuleAccess.mockReturnValue(
      accessState(buildModuleAvailability({ finance: false }, { finance: true }), "admin"),
    );

    await renderAt("/finance/invoices/new");

    expect(container.textContent).toContain("errors.route.moduleUnavailableTitle");
    expect(container.querySelector("a")).toBeNull();
  });

  it("given a disabled module and a module manager, should link to Settings → Modules", async () => {
    mockUseModuleAccess.mockReturnValue(
      accessState(buildModuleAvailability(null, { finance: false }), "admin"),
    );

    await renderAt("/finance");
    const link = container.querySelector("a");
    await act(async () => link?.click());

    expect(link?.textContent).toBe("errors.route.openModuleSettings");
    expect(container.textContent).toContain("Settings page");
  });

  it("given a disabled module and a viewer who cannot manage modules, should not show the link", async () => {
    mockUseModuleAccess.mockReturnValue(
      accessState(buildModuleAvailability(null, { finance: false }), "accountant"),
    );

    await renderAt("/finance");

    expect(container.textContent).toContain("errors.route.moduleDisabledTitle");
    expect(container.querySelector("a")).toBeNull();
  });

  it("given an enabled module without the read permission, should show insufficient permissions", async () => {
    mockUseModuleAccess.mockReturnValue(
      accessState(buildModuleAvailability(null, null), "teacher"),
    );

    await renderAt("/finance");

    expect(container.textContent).toContain("errors.route.forbiddenTitle");
    expect(container.textContent).not.toContain("Finance page");
  });

  it("given a faculty route, should gate it on the faculty module", async () => {
    mockUseModuleAccess.mockReturnValue(
      accessState(buildModuleAvailability(null, { faculty: false }), "admin"),
    );

    await renderAt("/faculty");

    expect(container.textContent).toContain("errors.route.moduleDisabledTitle");
  });

  it("given access is revoked mid-session, should replace the open page with the denial state", async () => {
    mockUseModuleAccess.mockReturnValue(accessState(buildModuleAvailability(null, null), "admin"));
    await renderAt("/finance");
    expect(container.textContent).toContain("Finance page");

    mockUseModuleAccess.mockReturnValue(
      accessState(buildModuleAvailability(null, { finance: false }), "admin"),
    );
    await renderAt("/finance");

    expect(container.textContent).not.toContain("Finance page");
    expect(container.textContent).toContain("errors.route.moduleDisabledTitle");
  });

  it.each([
    ["/", "Home page"],
    ["/profile", "Profile page"],
  ])("given %s, should render even while access is loading", async (path, page) => {
    mockUseModuleAccess.mockReturnValue(accessState(null, "guardian", "pending"));

    await renderAt(path);

    expect(container.textContent).toContain(page);
  });
});
