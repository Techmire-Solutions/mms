import { describe, it, expect, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { PlatformAiDrawer } from "./PlatformAiDrawer";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "platform.aiCopilotTitle": "Platform Copilot",
        "platform.aiCopilotSubtitle": "Contextual AI Diagnostics & Assistant",
        "platform.aiAskPlaceholder": "Ask Copilot...",
        "platform.aiAnalyzing": "Analyzing...",
        "common.delete": "Delete",
        "common.close": "Close",
        "common.send": "Send",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("PlatformAiDrawer", () => {
  it("returns null when isOpen is false", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <PlatformAiDrawer isOpen={false} onClose={vi.fn()} />
        </MemoryRouter>,
      );
    });

    expect(container.innerHTML).toBe("");

    act(() => root.unmount());
    container.remove();
  });

  it("renders modal dialog and responds to close button and escape key", () => {
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <PlatformAiDrawer isOpen={true} onClose={onClose} />
        </MemoryRouter>,
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(container.textContent).toContain("Platform Copilot");

    // Click close button
    const closeBtn = container.querySelector('button[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
    act(() => {
      (closeBtn as HTMLButtonElement).click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Press Escape key
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    act(() => root.unmount());
    container.remove();
  });
});
