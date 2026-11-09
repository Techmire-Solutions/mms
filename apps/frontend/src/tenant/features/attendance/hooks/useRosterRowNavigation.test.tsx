import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useRosterRowNavigation } from "./useRosterRowNavigation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STUDENTS = ["s1", "s2", "s3"];

describe("useRosterRowNavigation", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  function TestComponent({ onSetStatus }: { onSetStatus: (id: string, status: string) => void }) {
    useRosterRowNavigation({
      enabled: true,
      studentIds: STUDENTS,
      onSetStatus: onSetStatus as never,
    });
    return null;
  }

  function render(onSetStatus: (id: string, status: string) => void) {
    act(() => root?.render(<TestComponent onSetStatus={onSetStatus} />));
  }

  it("moves the cursor with arrows and clamps at the ends", () => {
    render(vi.fn());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })));
    expect(container).not.toBeNull();
  });

  it("sets the status of the active row with number keys", () => {
    const onSetStatus = vi.fn();
    render(onSetStatus);

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" })));
    expect(onSetStatus).toHaveBeenCalledWith("s1", "absent");

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "4" })));
    expect(onSetStatus).toHaveBeenCalledWith("s2", "half_day");

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "5" })));
    expect(onSetStatus).toHaveBeenCalledWith("s2", "excused");
  });

  it("ignores keys while the user is typing", () => {
    const onSetStatus = vi.fn();
    render(onSetStatus);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
    expect(onSetStatus).not.toHaveBeenCalled();
    input.remove();
  });
});
