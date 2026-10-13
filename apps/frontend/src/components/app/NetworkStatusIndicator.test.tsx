import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NetworkStatusIndicator } from "./NetworkStatusIndicator";

const mockTranslations: Record<string, string> = {
  "network.offlineBanner": "You are currently offline. Working from local cache.",
  "network.reconnectingBanner": "Reconnecting to network and syncing data...",
  "network.onlineRestored": "Connection restored. State synchronized.",
};

// Mock translation hook
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => mockTranslations[key] ?? key,
  }),
}));

describe("NetworkStatusIndicator", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalOnLine: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    originalOnLine = navigator.onLine;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: originalOnLine,
    });
  });

  it("renders null when the browser is initially online", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await act(async () => {
      root.render(<NetworkStatusIndicator />);
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders offline indicator when the browser is initially offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await act(async () => {
      root.render(<NetworkStatusIndicator />);
    });

    const statusEl = container.querySelector('[role="status"]');
    expect(statusEl).not.toBeNull();
    expect(container.textContent).toContain("You are currently offline. Working from local cache.");
  });

  it("transitions to reconnecting and then online when connectivity returns", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await act(async () => {
      root.render(<NetworkStatusIndicator />);
    });

    expect(container.textContent).toContain("You are currently offline. Working from local cache.");

    // Fire online event
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(container.textContent).toContain("Reconnecting to network and syncing data...");

    // Advance timer past reconnect delay
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(container.textContent).toContain("Connection restored. State synchronized.");

    // Advance timer past dismiss delay
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
