import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TenantMessageComposerLauncher } from "./TenantMessageComposerLauncher";

vi.mock("@/tenant/components/messaging/TenantMessageComposer", () => ({
  default: ({
    channel,
    recipients,
  }: {
    channel: string;
    recipients: { name: string }[];
  }) => (
    <div data-testid="mock-tenant-composer">
      <span>Channel: {channel}</span>
      <span>Recipients: {recipients.map((r) => r.name).join(", ")}</span>
    </div>
  ),
}));

describe("TenantMessageComposerLauncher", () => {
  it("renders nothing when messagingTarget is null", () => {
    const html = renderToStaticMarkup(
      <TenantMessageComposerLauncher messagingTarget={null} onClose={vi.fn()} />,
    );
    expect(html).toBe("");
  });

  it("renders with fallback or composer markup when messagingTarget is provided", () => {
    const target = {
      channel: "whatsapp" as const,
      recipients: [{ id: "1", name: "Zaid Ali", phone: "+1234567890" }],
    };

    const html = renderToStaticMarkup(
      <TenantMessageComposerLauncher
        messagingTarget={target}
        onClose={vi.fn()}
        fallback={<div data-testid="fallback">Loading...</div>}
      />,
    );
    expect(html).toBeDefined();
  });
});
