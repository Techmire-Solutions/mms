import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityMessagingActions } from "./EntityMessagingActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

describe("EntityMessagingActions Component", () => {
  const defaultLabels = {
    call: "Call",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
  };

  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it("renders icon-row variant with phone and email actions", () => {
    const html = renderToStaticMarkup(
      <EntityMessagingActions
        variant="icon-row"
        primaryPhone="+15551234567"
        primaryEmail="test@example.com"
        labels={defaultLabels}
      />,
    );

    expect(html).toContain("tel:+15551234567");
    expect(html).toContain("mailto:test@example.com");
    expect(html).toContain("https://wa.me/15551234567");
    expect(html).toContain("sms:+15551234567");
  });

  it("renders button-group variant in a responsive grid", () => {
    const html = renderToStaticMarkup(
      <EntityMessagingActions
        variant="button-group"
        primaryPhone="+15551234567"
        primaryEmail="test@example.com"
        labels={defaultLabels}
        onWhatsApp={() => {}}
        onSms={() => {}}
        onEmail={() => {}}
      />,
    );

    expect(html).toContain("grid-cols-2");
    expect(html).toContain("sm:grid-cols-4");
    expect(html).toContain("Call");
    expect(html).toContain("WhatsApp");
    expect(html).toContain("SMS");
    expect(html).toContain("Email");
  });

  it("renders dropdown menu items variant within a dropdown menu in the DOM", () => {
    act(() => {
      root?.render(
        <DropdownMenu open={true}>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <EntityMessagingActions
              variant="dropdown"
              showWhatsApp={true}
              showSms={true}
              showEmail={true}
              labels={defaultLabels}
              onWhatsApp={() => {}}
              onSms={() => {}}
              onEmail={() => {}}
            />
          </DropdownMenuContent>
        </DropdownMenu>,
      );
    });

    expect(document.body.textContent).toContain("WhatsApp");
    expect(document.body.textContent).toContain("SMS");
    expect(document.body.textContent).toContain("Email");
  });

  it("returns null when showArchived is true", () => {
    const html = renderToStaticMarkup(
      <EntityMessagingActions
        variant="icon-row"
        showArchived={true}
        primaryPhone="+15551234567"
        labels={defaultLabels}
      />,
    );

    expect(html).toBe("");
  });
});
