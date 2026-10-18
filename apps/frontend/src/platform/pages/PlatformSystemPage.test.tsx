import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformSystemPage from "./PlatformSystemPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => {
      const map: Record<string, string> = {
        "platform.systemMaintenance": "System Maintenance",
        "platform.systemMaintenanceSubtitle": "Database health and service telemetry",
        "platform.consoleTitle": "Platform Console",
      };
      return map[k] ?? k;
    },
  }),
}));

vi.mock("@/platform/components/PlatformSystemMaintenance", () => ({
  PlatformSystemMaintenance: () => (
    <div data-testid="platform-system-maintenance">System Telemetry</div>
  ),
}));

describe("PlatformSystemPage", () => {
  it("renders system page with header and maintenance view", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSystemPage />
      </MemoryRouter>,
    );

    expect(html).toContain("System Maintenance");
    expect(html).toContain("Database health and service telemetry");
    expect(html).toContain("System Telemetry");
  });
});
