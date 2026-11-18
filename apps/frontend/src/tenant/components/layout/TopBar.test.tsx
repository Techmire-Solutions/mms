import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import TopBar from "./TopBar";
import TopBarActions from "./TopBarActions";
import { TenantBackgroundJobsTray } from "./TenantBackgroundJobsTray";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Amina Accountant", email: "amina@example.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/tenant/hooks/useBackgroundJobs", () => ({
  useBackgroundJobs: () => ({
    jobs: [],
    activeJobs: [],
    dismiss: vi.fn(),
    clearFinished: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/tenant/components/layout/SyncStatusBadge", () => ({
  SyncStatusBadge: () => <div data-testid="sync-status">Sync</div>,
}));

vi.mock("@/tenant/components/layout/TenantNotificationsPopover", () => ({
  TenantNotificationsPopover: () => <div data-testid="notifications">Notifications</div>,
}));

vi.mock("@/components/app/UserNavDropdown", () => ({
  UserNavDropdown: ({ name }: { name: string }) => <div data-testid="user-nav">{name}</div>,
}));

describe("TopBar and TopBarActions", () => {
  it("renders desktop search affordance in TopBar", () => {
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TopBar onOpenCommandPalette={onOpen} />
      </MemoryRouter>,
    );

    expect(html).toContain("nav.globalSearchPlaceholder");
    expect(html).toContain("ps-9 pe-3");
  });

  it("renders topbar actions including sync status, notifications, and user nav", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TopBarActions compact={false} onOpenCommandPalette={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).toContain("Sync");
    expect(html).toContain("Notifications");
    expect(html).toContain("Amina Accountant");
  });

  it("renders compact mode search button in TopBarActions", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TopBarActions compact={true} onOpenCommandPalette={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).toContain("nav.globalSearchPlaceholder");
  });

  it("renders TenantBackgroundJobsTray component", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TenantBackgroundJobsTray />
      </MemoryRouter>,
    );

    expect(typeof html).toBe("string");
  });
});
