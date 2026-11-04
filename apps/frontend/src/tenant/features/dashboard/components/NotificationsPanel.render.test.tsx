import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardNotificationItem } from "@/lib/buildDashboardNotifications";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: "u-admin" } }),
}));

import NotificationsPanel from "./NotificationsPanel";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const items: DashboardNotificationItem[] = [
  {
    id: "notif-1",
    type: "fee",
    title: "Overdue invoice",
    desc: "Invoice #101 is overdue",
    time: "1h ago",
    urgent: true,
  },
  {
    id: "notif-2",
    type: "event",
    title: "Staff meeting",
    desc: "Weekly sync",
    time: "2h ago",
  },
];

describe("NotificationsPanel rendering", () => {
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
    vi.restoreAllMocks();
  });

  const render = () =>
    act(() => {
      root.render(<NotificationsPanel items={items} />);
    });

  it("unclamps the list for print so every notification reaches paper", () => {
    render();

    const list = container.querySelector("[aria-live='polite']") as HTMLElement;
    expect(list.className).toContain("max-h-notifications");
    expect(list.className).toContain("print:max-h-none");
    expect(list.className).toContain("print:overflow-visible");
  });

  it("keeps the dismiss control legible on both themes", () => {
    render();

    const dismiss = container.querySelector("[aria-label^='notifications.dismiss']") as HTMLElement;
    expect(dismiss).not.toBeNull();
    // 30 % muted icons failed the 3:1 non-text contrast rule.
    expect(dismiss.className).not.toContain("text-muted-foreground/30");
    expect(dismiss.className).toContain("text-muted-foreground");
    expect(dismiss.className).toContain("hover:text-destructive");
  });

  it("stops the urgency pulse when the user prefers reduced motion", () => {
    const matchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    });

    try {
      render();
      expect(container.innerHTML).not.toContain("animate-pulse");
    } finally {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: matchMedia,
      });
    }
  });
});
