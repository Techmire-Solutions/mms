import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageComposerLivePreview } from "./MessageComposerLivePreview";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

describe("MessageComposerLivePreview", () => {
  const recipients = [
    { id: "1", name: "Zaid Ali", phone: "+1234567890", email: "zaid@example.com", isValid: true },
    { id: "2", name: "Fatima Khan", phone: "+1987654321", email: "fatima@example.com", isValid: true },
  ];

  it("returns null when message is empty", () => {
    const html = renderToStaticMarkup(
      <MessageComposerLivePreview
        channel="whatsapp"
        message=""
        subject=""
        eligibleRecipients={recipients}
        previewIndex={0}
        personalizeOptions={{ madrasaName: "Test Madrasa" }}
        onPreviewIndexChange={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("renders live preview and bulk recipient dropdown when multiple recipients exist", () => {
    const html = renderToStaticMarkup(
      <MessageComposerLivePreview
        channel="whatsapp"
        message="Assalamu alaikum {name}"
        subject=""
        eligibleRecipients={recipients}
        previewIndex={0}
        personalizeOptions={{ madrasaName: "Test Madrasa" }}
        onPreviewIndexChange={vi.fn()}
      />,
    );

    expect(html).toContain("Assalamu alaikum Zaid Ali");
    expect(html).toContain("<select");
    expect(html).toContain("1. Zaid Ali");
    expect(html).toContain("2. Fatima Khan");
  });

  it("renders single recipient preview without select dropdown", () => {
    const html = renderToStaticMarkup(
      <MessageComposerLivePreview
        channel="sms"
        message="Hello {name}"
        subject=""
        eligibleRecipients={[recipients[0]!]}
        previewIndex={0}
        personalizeOptions={{ madrasaName: "Test Madrasa" }}
        onPreviewIndexChange={vi.fn()}
      />,
    );

    expect(html).toContain("Hello Zaid Ali");
    expect(html).not.toContain("<select");
  });
});
