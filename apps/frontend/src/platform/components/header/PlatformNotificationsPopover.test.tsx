import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformNotificationsPopover } from "./PlatformNotificationsPopover";
import type { PlatformWorkspaceRow } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/platform/hooks/usePlatformNotificationAck", () => ({
  usePlatformNotificationAck: () => ({
    ackedIds: new Set<string>(),
    ackAll: vi.fn(),
  }),
}));

const mockWorkspaces: PlatformWorkspaceRow[] = [
  {
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    enabled: true,
    requireEmailVerification: true,
    adminEmail: "admin@demo.mms",
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("PlatformNotificationsPopover", () => {
  it("renders notifications trigger button with min-h-11 touch floor", () => {
    const html = renderToStaticMarkup(
      <PlatformNotificationsPopover workspaces={mockWorkspaces} isSuperUser={true} />,
    );

    expect(html).toContain("min-h-11");
    expect(html).toContain("min-w-11");
    expect(html).toContain("platform.notificationsAria");
  });
});
