import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { notificationReadKey, useNotificationReadState } from "./useNotificationReadState";

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  updateState: vi.fn<(key: string, value: unknown) => void>(),
}));

vi.mock("@mms/fe-core/auth/useUiStateStore", () => ({
  useUiStateStore: {
    getState: () => ({ state: mocks.state }),
  },
  useUiPreference: <T,>(key: string, defaultValue: T): [T, (val: T) => void] => [
    (mocks.state[key] as T | undefined) ?? defaultValue,
    (val: T) => {
      mocks.state = { ...mocks.state, [key]: val };
      mocks.updateState(key, val);
    },
  ],
}));

function renderHook() {
  let result!: ReturnType<typeof useNotificationReadState>;
  function Harness() {
    result = useNotificationReadState();
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(<Harness />);
  });
  return {
    current: () => result,
    unmount: () => act(() => root.unmount()),
  };
}

const item = (id: string): { id: string; title: string } => ({
  id,
  title: "title",
});

describe("useNotificationReadState", () => {
  beforeEach(() => {
    mocks.state = {};
    mocks.updateState.mockReset();
  });

  it("marks an item read exactly once when marked twice in the same tick", () => {
    // Regression: `persist` merged against the render snapshot of `readKeys`,
    // so two marks before a re-render appended the key twice (duplicates evict
    // unique keys at the 100-entry cap and double-sync the store).
    const { current, unmount } = renderHook();
    const key = notificationReadKey(item("a"));

    act(() => {
      current().markRead(item("a"));
      current().markRead(item("a"));
    });

    expect(mocks.updateState).toHaveBeenCalledTimes(1);
    expect(mocks.updateState).toHaveBeenCalledWith("notifications_read", [key]);
    unmount();
  });

  it("appends a new key to the already-persisted list", () => {
    mocks.state = { notifications_read: ["a|today|old title"] };
    const { current, unmount } = renderHook();
    const key = notificationReadKey(item("b"));

    act(() => {
      current().markRead(item("b"));
    });

    expect(mocks.updateState).toHaveBeenCalledWith("notifications_read", [
      "a|today|old title",
      key,
    ]);
    unmount();
  });

  it("caps the persisted list at the last 100 read keys", () => {
    const { current, unmount } = renderHook();
    const items = Array.from({ length: 110 }, (_, i) => item(`n${i}`));

    act(() => {
      current().markAllRead(items);
    });

    const written = mocks.updateState.mock.calls[0][1] as string[];
    expect(written).toHaveLength(100);
    expect(written[written.length - 1]).toBe(notificationReadKey(item("n109")));
    unmount();
  });
});
