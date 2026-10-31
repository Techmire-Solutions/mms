import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "@mms/shared";
import { useMessagingWorkTierKeyboardNav } from "./useMessagingWorkTierKeyboardNav";

describe("useMessagingWorkTierKeyboardNav", () => {
  const dummyLog1: Message = {
    id: "1",
    tenantId: "t1",
    channel: "sms",
    to: "+123456789",
    body: "Message 1",
    status: "delivered",
    createdAt: new Date().toISOString(),
  } as unknown as Message;

  const dummyLog2: Message = {
    id: "2",
    tenantId: "t1",
    channel: "sms",
    to: "+987654321",
    body: "Message 2",
    status: "delivered",
    createdAt: new Date().toISOString(),
  } as unknown as Message;

  it("resets focusedIndex to -1 when logs change", () => {
    const toggleLog = vi.fn();
    const handleOpenDetail = vi.fn();
    let currentFocused = 0;

    function TestComponent({ logs }: { logs: Message[] }) {
      const { focusedIndex } = useMessagingWorkTierKeyboardNav({
        logs,
        toggleLog,
        handleOpenDetail,
      });
      currentFocused = focusedIndex;
      return <div>{focusedIndex}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent logs={[dummyLog1]} />);
    });
    expect(currentFocused).toBe(-1);

    act(() => {
      root.render(<TestComponent logs={[]} />);
    });
    expect(currentFocused).toBe(-1);

    act(() => {
      root.unmount();
    });
  });

  it("handles keyboard navigation (ArrowDown, ArrowUp, Space, Enter)", () => {
    const toggleLog = vi.fn();
    const handleOpenDetail = vi.fn();
    let currentFocused = -1;

    function TestComponent({ logs }: { logs: Message[] }) {
      const { focusedIndex } = useMessagingWorkTierKeyboardNav({
        logs,
        toggleLog,
        handleOpenDetail,
      });
      currentFocused = focusedIndex;
      return <div>{focusedIndex}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent logs={[dummyLog1, dummyLog2]} />);
    });

    // ArrowDown moves from -1 to 0
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(currentFocused).toBe(0);

    // ArrowDown moves from 0 to 1
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(currentFocused).toBe(1);

    // ArrowDown wraps from 1 to 0
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(currentFocused).toBe(0);

    // ArrowUp wraps from 0 to 1
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(currentFocused).toBe(1);

    // ArrowUp moves from 1 to 0
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(currentFocused).toBe(0);

    // Space toggles current log
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(toggleLog).toHaveBeenCalledWith(dummyLog1, false);

    // Enter opens detail
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(handleOpenDetail).toHaveBeenCalledWith(dummyLog1);

    act(() => {
      root.unmount();
    });
  });
});
