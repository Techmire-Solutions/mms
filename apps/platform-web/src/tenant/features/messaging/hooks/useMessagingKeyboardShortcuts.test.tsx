import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMessagingKeyboardShortcuts } from "./useMessagingKeyboardShortcuts";

function renderHookHost(startCampaign: (channel: "whatsapp" | "sms" | "email") => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Host() {
    useMessagingKeyboardShortcuts({
      canWrite: true,
      hasActiveComposer: false,
      startCampaign,
    });
    return <input data-testid="field" />;
  }

  act(() => {
    root.render(<Host />);
  });

  return {
    container,
    press: (target: EventTarget, key: string) => {
      act(() => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useMessagingKeyboardShortcuts", () => {
  beforeEach(() => {
    document
      .querySelectorAll("[role='dialog'],[aria-modal='true']")
      .forEach((node) => node.remove());
  });

  it("starts the matching channel campaign for bare w/s/e", () => {
    const startCampaign = vi.fn();
    const host = renderHookHost(startCampaign);

    host.press(document.body, "w");
    host.press(document.body, "s");
    host.press(document.body, "e");

    expect(startCampaign.mock.calls).toEqual([["whatsapp"], ["sms"], ["email"]]);
    host.unmount();
  });

  it("ignores keystrokes that originate in a text field", () => {
    const startCampaign = vi.fn();
    const host = renderHookHost(startCampaign);

    const field = host.container.querySelector("input")!;
    host.press(field, "s");

    expect(startCampaign).not.toHaveBeenCalled();
    host.unmount();
  });

  it("does not fire underneath an open dialog", () => {
    const startCampaign = vi.fn();
    const host = renderHookHost(startCampaign);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    host.press(document.body, "w");

    expect(startCampaign).not.toHaveBeenCalled();
    dialog.remove();
    host.unmount();
  });

  it("ignores modified keystrokes", () => {
    const startCampaign = vi.fn();
    const host = renderHookHost(startCampaign);

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }),
      );
    });

    expect(startCampaign).not.toHaveBeenCalled();
    host.unmount();
  });
});
