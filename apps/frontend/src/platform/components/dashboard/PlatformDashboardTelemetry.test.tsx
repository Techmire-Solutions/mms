import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformDashboardTelemetry } from "./PlatformDashboardTelemetry";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    canSystem: true,
  }),
}));

describe("PlatformDashboardTelemetry", () => {
  it("given system permission, should render compact health summary with CTA to System", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformDashboardTelemetry />
      </MemoryRouter>,
    );

    expect(html).toContain("platform.dashboard.systemHealth");
    expect(html).toContain("platform.dashboard.systemHealthHint");
    expect(html).toContain("platform.dashboard.openSystem");
    expect(html).toContain("/platform/system");
    expect(html).not.toContain("platform.telemetry.dbPoolLoad");
  });
});
