import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityLogInspectModal } from "./ActivityLogInspectModal";
import type { PlatformActivityLogItem } from "@/platform/hooks/usePlatformActivityLogs";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/app/CopyButton", () => ({
  CopyButton: ({ text, label }: { text: string; label?: string }) => (
    <button data-testid="copy-btn" data-text={text}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: ({ tabs }: { tabs: { key: string; label: string }[] }) => (
    <div data-testid="sub-tab-bar">
      {tabs.map((tab) => (
        <span key={tab.key}>{tab.label}</span>
      ))}
    </div>
  ),
}));

describe("ActivityLogInspectModal", () => {
  const mockLog: PlatformActivityLogItem = {
    id: "log-123",
    userId: "u-1",
    userEmail: "admin@platform.local",
    action: "update_workspace_modules",
    targetResource: "workspace",
    targetId: "demo",
    ipAddress: "127.0.0.1",
    metadataMessage: "modules=[students,accounting]",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("renders modal with event metadata, json tabs, and copy action", () => {
    const html = renderToStaticMarkup(<ActivityLogInspectModal log={mockLog} onClose={vi.fn()} />);

    expect(html).toContain("platform.logs.inspectJson");
    expect(html).toContain("platform.logs.viewFullEvent");
    expect(html).toContain("platform.logs.viewPayload");
    expect(html).toContain("log-123");
    expect(html).toContain("127.0.0.1");
  });

  it("returns null when log is null", () => {
    const html = renderToStaticMarkup(<ActivityLogInspectModal log={null} onClose={vi.fn()} />);

    expect(html).toBe("");
  });
});
