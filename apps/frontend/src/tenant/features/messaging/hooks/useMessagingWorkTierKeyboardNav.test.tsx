import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useMessagingWorkTierKeyboardNav } from "./useMessagingWorkTierKeyboardNav";
import type { Message } from "@mms/shared";

describe("useMessagingWorkTierKeyboardNav", () => {
  it("initializes focusedIndex to -1 and does not loop on new array references", () => {
    const toggleLog = vi.fn();
    const handleOpenDetail = vi.fn();

    let latestResult!: { focusedIndex: number };
    let currentLogs: Message[] = [];

    function TestComponent({ logs }: { logs: Message[] }) {
      latestResult = useMessagingWorkTierKeyboardNav({
        logs,
        toggleLog,
        handleOpenDetail,
      });
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent logs={currentLogs} />);
    });

    expect(latestResult.focusedIndex).toBe(-1);

    // Repeated renders with fresh array instances (simulating query fallback `?? []`)
    for (let i = 0; i < 30; i++) {
      act(() => {
        currentLogs = [];
        root.render(<TestComponent logs={currentLogs} />);
      });
    }

    // Must not throw React error #301 (exceeded 25 render limit)
    expect(latestResult.focusedIndex).toBe(-1);

    act(() => {
      root.unmount();
    });
  });
});
