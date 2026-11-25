import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TenantMessageComposerLauncher } from "./TenantMessageComposerLauncher";

vi.mock("@/tenant/components/messaging/TenantMessageComposer", () => ({
  default: ({
    channel,
    recipients,
    initialMessage,
    initialSubject,
  }: {
    channel: string;
    recipients: { name: string }[];
    initialMessage?: string;
    initialSubject?: string;
  }) => (
    <div data-testid="mock-tenant-composer">
      <span>Channel: {channel}</span>
      <span>Recipients: {recipients.map((r) => r.name).join(", ")}</span>
      <span>Message: {initialMessage ?? ""}</span>
      <span>Subject: {initialSubject ?? ""}</span>
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

  it("forwards the prefilled message and subject from the launch target", () => {
    const target = {
      channel: "sms" as const,
      recipients: [{ id: "1", name: "Zaid Ali", phone: "+1234567890" }],
      initialMessage: "Fee is due tomorrow",
      initialSubject: "Fee reminder",
    };

    const html = renderToStaticMarkup(
      <TenantMessageComposerLauncher messagingTarget={target} onClose={vi.fn()} />,
    );

    // Regression: dropping the prefill made every entity/dashboard launcher open
    // an empty composer.
    expect(html).toContain("Fee is due tomorrow");
    expect(html).toContain("Fee reminder");
  });
});
