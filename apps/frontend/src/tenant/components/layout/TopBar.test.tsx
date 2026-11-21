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
  });

  it("keeps the search icon in flow so it cannot overlap the placeholder", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TopBar onOpenCommandPalette={vi.fn()} />
      </MemoryRouter>,
    );
    const trigger =
      html.match(/<button[^>]*aria-keyshortcuts="Control\+K Meta\+K"[^>]*>/)?.[0] ?? "";
    const icon = html.match(/<svg[^>]*lucide-search[^>]*>/)?.[0] ?? "";

    // Button nests children in a `relative` span, so an absolute icon would anchor
    // to that span (where the text starts) instead of the button padding.
    expect(icon).not.toBe("");
    expect(icon).not.toMatch(/\babsolute\b/);
    expect(trigger).toContain("[&amp;_[data-slot=button-content]]:w-full");
    expect(trigger).toContain("[&amp;_[data-slot=button-content]]:justify-start");
    expect(trigger).not.toMatch(/\bps-9\b/);
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
