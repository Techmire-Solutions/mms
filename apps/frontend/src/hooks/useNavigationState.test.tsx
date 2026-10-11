import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigationState, type NavigationState } from "./useNavigationState";
import { PlatformSidebarProvider, usePlatformSidebar } from "@/platform/lib/PlatformSidebarContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("navigation state ownership", () => {
  let container: HTMLDivElement;
  let root: Root;
  let tenant: NavigationState;
  let platform: NavigationState;

  function Tenant() {
    tenant = useNavigationState();
    return null;
  }
  function Platform() {
    platform = usePlatformSidebar();
    return null;
  }
  function render() {
    act(() =>
      root.render(
        <>
          <Tenant />
          <PlatformSidebarProvider>
            <Platform />
          </PlatformSidebarProvider>
        </>,
      ),
    );
  }

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("keeps persisted platform state separate from tenant state", () => {
    localStorage.setItem("mms_platform_sidebar_collapsed", "true");
    render();
    expect(platform.collapsed).toBe(true);
    expect(tenant.collapsed).toBe(false);
    act(() => tenant.toggleCollapsed());
    act(() => platform.toggleCollapsed());
    expect(tenant.collapsed).toBe(true);
    expect(platform.collapsed).toBe(false);
    expect(localStorage.getItem("mms_platform_sidebar_collapsed")).toBe("false");
  });

  it("supports functional updates and independent mobile and palette controls", () => {
    render();
    act(() => {
      tenant.toggleCollapsed();
      tenant.toggleCollapsed();
      tenant.openMobileSidebar();
      tenant.openCommandPalette();
    });
    expect(tenant.collapsed).toBe(false);
    expect(tenant.mobileOpen).toBe(true);
    expect(tenant.commandPaletteOpen).toBe(true);
    expect(platform.mobileOpen).toBe(false);
    expect(platform.commandPaletteOpen).toBe(false);
    act(() => {
      tenant.closeMobileSidebar();
      tenant.closeCommandPalette();
      platform.setCommandPaletteOpen((previous) => !previous);
    });
    expect(tenant.mobileOpen).toBe(false);
    expect(tenant.commandPaletteOpen).toBe(false);
    expect(platform.commandPaletteOpen).toBe(true);
  });

  it("continues operating when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render();
    expect(platform.collapsed).toBe(false);
    act(() => platform.toggleCollapsed());
    expect(platform.collapsed).toBe(true);
  });
});
