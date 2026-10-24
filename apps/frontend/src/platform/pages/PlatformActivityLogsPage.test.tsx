import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformActivityLogsPage from "./PlatformActivityLogsPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => {
      const map: Record<string, string> = {
        "platform.activityLogsTitle": "Audit & Activity Logs",
        "platform.activityLogsSubtitle": "Security events and mutation history",
        "platform.consoleTitle": "Platform Console",
      };
      return map[k] ?? k;
    },
  }),
}));

vi.mock("@/platform/components/PlatformActivityLogsContent", () => ({
  default: () => <div data-testid="platform-activity-logs-content">Activity Logs Content</div>,
}));

describe("PlatformActivityLogsPage", () => {
  it("renders activity logs page with header and content", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformActivityLogsPage />
      </MemoryRouter>,
    );

    expect(html).toContain("Audit &amp; Activity Logs");
    expect(html).toContain("Security events and mutation history");
    expect(html).toContain("Activity Logs Content");
  });
});
