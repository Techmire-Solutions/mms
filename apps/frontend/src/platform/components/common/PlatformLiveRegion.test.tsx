import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { LiveRegionProvider, useLiveAnnouncer } from "@shared/ui";

describe("LiveRegionProvider & useLiveAnnouncer (@shared/ui)", () => {
  it("renders dual live regions with correct ARIA roles and attributes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <LiveRegionProvider>
          <div>Content</div>
        </LiveRegionProvider>,
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

    let announcer!: ReturnType<typeof useLiveAnnouncer>;

    function TestConsumer() {
      announcer = useLiveAnnouncer();
      return null;
    }

    act(() => {
      root.render(
        <LiveRegionProvider>
          <TestConsumer />
        </LiveRegionProvider>,
      );
    });

    act(() => {
      announcer.announcePolite("Telemetry refreshed");
      announcer.announceAssertive("Database connection pool degraded");
      vi.advanceTimersByTime(100);
    });

    const politeRegion = container.querySelector('[data-testid="live-region-polite"]');
    const alertRegion = container.querySelector('[data-testid="live-region-assertive"]');

    expect(politeRegion?.textContent).toBe("Telemetry refreshed");
    expect(alertRegion?.textContent).toBe("Database connection pool degraded");

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });
});
