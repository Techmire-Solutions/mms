import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useMarkAttendanceKeyboardShortcuts } from "./useMarkAttendanceKeyboardShortcuts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useMarkAttendanceKeyboardShortcuts", () => {
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
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  function TestComponent(props: Parameters<typeof useMarkAttendanceKeyboardShortcuts>[0]) {
    useMarkAttendanceKeyboardShortcuts(props);
    return null;
  }

  it("does not fire callbacks when disabled or canWrite is false", () => {
    const onSaveDraft = vi.fn();
    const onSubmit = vi.fn();
    const onMarkAll = vi.fn();

    act(() => {
      root?.render(
        <TestComponent
          enabled={false}
          canWrite={false}
          onMarkAll={onMarkAll}
          onSaveDraft={onSaveDraft}
          onSubmit={onSubmit}
        />,
      );
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }));
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it("handles SaveDraft and Submit keyboard shortcuts with Ctrl/Cmd", () => {
    const onSaveDraft = vi.fn();
    const onSubmit = vi.fn();
    const onMarkAll = vi.fn();

    act(() => {
      root?.render(
        <TestComponent
          enabled={true}
          canWrite={true}
          onMarkAll={onMarkAll}
          onSaveDraft={onSaveDraft}
          onSubmit={onSubmit}
        />,
      );
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
    expect(onSaveDraft).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("handles Alt/Shift mark-all shortcuts for present, absent, late", () => {
    const onSaveDraft = vi.fn();
    const onSubmit = vi.fn();
    const onMarkAll = vi.fn();

    act(() => {
      root?.render(
        <TestComponent
          enabled={true}
          canWrite={true}
          onMarkAll={onMarkAll}
          onSaveDraft={onSaveDraft}
          onSubmit={onSubmit}
        />,
      );
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", altKey: true }));
    expect(onMarkAll).toHaveBeenCalledWith("present");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", shiftKey: true }));
    expect(onMarkAll).toHaveBeenCalledWith("absent");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "l", altKey: true }));
    expect(onMarkAll).toHaveBeenCalledWith("late");
  });

  it("cleans up event listener on unmount", () => {
    const onSaveDraft = vi.fn();
    const onSubmit = vi.fn();
    const onMarkAll = vi.fn();

    act(() => {
      root?.render(
        <TestComponent
          enabled={true}
          canWrite={true}
          onMarkAll={onMarkAll}
          onSaveDraft={onSaveDraft}
          onSubmit={onSubmit}
        />,
      );
    });

    act(() => {
      root?.unmount();
      root = null;
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }));
    expect(onSaveDraft).not.toHaveBeenCalled();
  });
});
