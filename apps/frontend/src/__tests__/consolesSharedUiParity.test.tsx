import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Button,
  DataTable,
  ThemeScope,
  UiConfigProvider,
  type DataTableColumn,
} from "@shared/ui";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface WorkspaceRow {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
}

const workspaceColumns: DataTableColumn<WorkspaceRow>[] = [
  { id: "name", header: "Workspace", accessorKey: "name" },
  { id: "subdomain", header: "Domain", accessorKey: "subdomain" },
  { id: "plan", header: "Plan", accessorKey: "plan" },
];

const mockWorkspaces: WorkspaceRow[] = [
  { id: "ws-1", name: "Al-Huda Institute", subdomain: "alhuda", plan: "Enterprise" },
  { id: "ws-2", name: "Darul Uloom Central", subdomain: "du-central", plan: "Standard" },
];

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
          <UiConfigProvider
            config={{
              dir: "ltr",
              labels: {
                searchPlaceholder: "Filter workspaces...",
                emptyTitle: "No workspaces provisioned yet",
              },
            }}
          >
            <div data-testid="platform-shell">
              <Button variant="default">Create Workspace</Button>
              <DataTable
                data={mockWorkspaces}
                columns={workspaceColumns}
                onSearchChange={vi.fn()}
              />
            </div>
          </UiConfigProvider>
        </ThemeScope>,
      );
    });

    const themeWrapper = container.firstElementChild as HTMLElement;
    expect(themeWrapper.className).toContain("dark");
    expect(themeWrapper.style.getPropertyValue("--primary")).toBe("#d99b00");
    // Luminance > 0.179 -> black text for accessibility
    expect(themeWrapper.style.getPropertyValue("--primary-foreground")).toBe("#000000");

    expect(container.textContent).toContain("Create Workspace");
    expect(container.textContent).toContain("Al-Huda Institute");
    expect(container.textContent).toContain("alhuda");

    const searchInput = container.querySelector("input[type='search']") as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(searchInput.placeholder).toBe("Filter workspaces...");
  });

  it("renders Tenant Console theme with emerald branding, RTL layout, and Arabic labels", async () => {
    await act(async () => {
      root.render(
        <ThemeScope
          theme={{
            primary: "#0f766e", // Tenant Deep Teal/Emerald
            mode: "light",
            radius: "0.75rem",
          }}
        >
          <UiConfigProvider
            config={{
              dir: "rtl",
              labels: {
                searchPlaceholder: "البحث في السجلات...",
                emptyTitle: "لا توجد سجلات",
              },
            }}
          >
            <div data-testid="tenant-shell">
              <Button variant="default">إضافة طالب</Button>
              <DataTable
                data={mockWorkspaces}
                columns={workspaceColumns}
                onSearchChange={vi.fn()}
              />
            </div>
          </UiConfigProvider>
        </ThemeScope>,
      );
    });

    const themeWrapper = container.firstElementChild as HTMLElement;
    expect(themeWrapper.style.getPropertyValue("--primary")).toBe("#0f766e");
    // Deep emerald luminance <= 0.179 -> white text for contrast
    expect(themeWrapper.style.getPropertyValue("--primary-foreground")).toBe("#ffffff");

    expect(container.textContent).toContain("إضافة طالب");
    const searchInput = container.querySelector("input[type='search']") as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(searchInput.placeholder).toBe("البحث في السجلات...");
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
    expect(platformRoot.style.getPropertyValue("--primary-foreground")).toBe("#000000");

    expect(tenantRoot.style.getPropertyValue("--primary")).toBe("#0f766e");
    expect(tenantRoot.style.getPropertyValue("--primary-foreground")).toBe("#ffffff");
  });
});
