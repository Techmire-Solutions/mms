import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformLatencySparkline } from "./PlatformLatencySparkline";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "platform.maintenance.recentPings": "Recent Pings",
        "platform.maintenance.avgLatency": "Avg Latency",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("PlatformLatencySparkline", () => {
  it("returns null when history is empty", () => {
    const html = renderToStaticMarkup(
      <PlatformLatencySparkline history={[]} currentLatency={null} avgLatency={null} />,
    );

    expect(html).toBe("");
  });

  it("renders sparkline bars and average latency", () => {
    const html = renderToStaticMarkup(
      <PlatformLatencySparkline
        history={[45, 80, 120, 260]}
        currentLatency={260}
        avgLatency={126}
      />,
    );

    expect(html).toContain('role="region"');
    expect(html).toContain("Recent Pings");
    expect(html).toContain("Avg Latency: 126 ms");
    expect(html).toContain('title="45 ms"');
    expect(html).toContain('title="260 ms"');
  });
});
