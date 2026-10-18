import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { PlatformActivityLogsTimeline } from "./PlatformActivityLogsTimeline";
import type { PlatformActivityLogItem } from "@/platform/hooks/usePlatformActivityLogs";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

const mockLogs: PlatformActivityLogItem[] = [
  {
    id: "log-1",
    userId: "user-1",
    userEmail: "operator@example.com",
    action: "workspace_created",
    targetResource: "workspace",
    targetId: "sub-1",
    ipAddress: "127.0.0.1",
    metadataMessage: "Created workspace sub-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("PlatformActivityLogsTimeline", () => {
  it("renders standard timeline for non-virtualized lists (<=30 items)", () => {
    const html = renderToStaticMarkup(
      <PlatformActivityLogsTimeline logs={mockLogs} onInspect={vi.fn()} />,
    );

    expect(html).toContain("operator@example.com");
    expect(html).toContain("workspace created");
    expect(html).toContain("Created workspace sub-1");
  });
});
