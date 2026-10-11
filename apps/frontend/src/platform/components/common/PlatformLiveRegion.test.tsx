import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { PlatformLiveRegionProvider, usePlatformLiveAnnouncer } from "./PlatformLiveRegion";

describe("PlatformLiveRegionProvider & usePlatformLiveAnnouncer", () => {
  it("renders dual live regions with correct ARIA roles and attributes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PlatformLiveRegionProvider>
          <div>Content</div>
        </PlatformLiveRegionProvider>,
      );
    });

    const politeRegion = container.querySelector('[role="status"]');
    const alertRegion = container.querySelector('[role="alert"]');

    expect(politeRegion).not.toBeNull();
    expect(politeRegion?.getAttribute("aria-live")).toBe("polite");
    expect(politeRegion?.className).toContain("sr-only");

    expect(alertRegion).not.toBeNull();
    expect(alertRegion?.getAttribute("aria-live")).toBe("assertive");
    expect(alertRegion?.className).toContain("sr-only");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("broadcasts announcements into respective polite and assertive regions", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let announcer!: ReturnType<typeof usePlatformLiveAnnouncer>;

    function TestConsumer() {
      announcer = usePlatformLiveAnnouncer();
      return null;
    }

    act(() => {
      root.render(
        <PlatformLiveRegionProvider>
          <TestConsumer />
        </PlatformLiveRegionProvider>,
      );
    });

    act(() => {
      announcer.announcePolite("Telemetry refreshed");
      announcer.announceAssertive("Database connection pool degraded");
      vi.advanceTimersByTime(100);
    });

    const politeRegion = container.querySelector('[data-testid="platform-live-polite"]');
    const alertRegion = container.querySelector('[data-testid="platform-live-assertive"]');

    expect(politeRegion?.textContent).toBe("Telemetry refreshed");
    expect(alertRegion?.textContent).toBe("Database connection pool degraded");

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });
});
