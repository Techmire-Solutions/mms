import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Button, EmptyState, ThemeScope, UiConfigProvider } from "@mms/ui";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Cross-Console Shared UI Parity (Platform vs Tenant)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders Platform Console theme with amber palette, dark mode, and LTR defaults", async () => {
    await act(async () => {
      root.render(
        <ThemeScope
          theme={{
            primary: "#d99b00", // Platform Amber
            mode: "dark",
            radius: "0.5rem",
          }}
        >
          <UiConfigProvider config={{ dir: "ltr" }}>
            <div data-testid="platform-shell">
              <Button variant="default">Create Workspace</Button>
              <EmptyState title="No workspaces provisioned yet" />
            </div>
          </UiConfigProvider>
        </ThemeScope>,
      );
    });

    const themeWrapper = container.firstElementChild as HTMLElement;
    expect(themeWrapper.className).toContain("dark");
    expect(themeWrapper.style.getPropertyValue("--primary")).toBe("#d99b00");
    // Luminance > 0.179 -> black text for accessibility
    expect(themeWrapper.style.getPropertyValue("--primary-foreground")).toBe("black");

    expect(container.textContent).toContain("Create Workspace");
    expect(container.textContent).toContain("No workspaces provisioned yet");
  });

  it("renders Tenant Console theme with emerald branding, RTL layout, and localized content", async () => {
    await act(async () => {
      root.render(
        <ThemeScope
          theme={{
            primary: "#0f766e", // Tenant Deep Teal/Emerald
            mode: "light",
            radius: "0.75rem",
          }}
        >
          <UiConfigProvider config={{ dir: "rtl" }}>
            <div data-testid="tenant-shell">
              <Button variant="default">إضافة طالب</Button>
              <EmptyState title="لا توجد سجلات" />
            </div>
          </UiConfigProvider>
        </ThemeScope>,
      );
    });

    const themeWrapper = container.firstElementChild as HTMLElement;
    expect(themeWrapper.style.getPropertyValue("--primary")).toBe("#0f766e");
    // Deep emerald luminance <= 0.179 -> white text for contrast
    expect(themeWrapper.style.getPropertyValue("--primary-foreground")).toBe("white");

    expect(container.textContent).toContain("إضافة طالب");
    expect(container.textContent).toContain("لا توجد سجلات");
  });

  it("guarantees context isolation between concurrent platform and tenant scopes", async () => {
    await act(async () => {
      root.render(
        <div>
          {/* Platform Console Scope */}
          <ThemeScope theme={{ primary: "#d99b00" }}>
            <UiConfigProvider config={{ dir: "ltr", labels: { cancel: "Cancel" } }}>
              <div id="platform-scope">
                <Button variant="default">Platform Action</Button>
              </div>
            </UiConfigProvider>
          </ThemeScope>

          {/* Tenant Console Scope */}
          <ThemeScope theme={{ primary: "#0f766e" }}>
            <UiConfigProvider config={{ dir: "rtl", labels: { cancel: "إلغاء" } }}>
              <div id="tenant-scope">
                <Button variant="default">Tenant Action</Button>
              </div>
            </UiConfigProvider>
          </ThemeScope>
        </div>,
      );
    });

    const platformRoot = container.querySelector("#platform-scope")?.parentElement as HTMLElement;
    const tenantRoot = container.querySelector("#tenant-scope")?.parentElement as HTMLElement;

    expect(platformRoot.style.getPropertyValue("--primary")).toBe("#d99b00");
    expect(platformRoot.style.getPropertyValue("--primary-foreground")).toBe("black");

    expect(tenantRoot.style.getPropertyValue("--primary")).toBe("#0f766e");
    expect(tenantRoot.style.getPropertyValue("--primary-foreground")).toBe("white");
  });
});
