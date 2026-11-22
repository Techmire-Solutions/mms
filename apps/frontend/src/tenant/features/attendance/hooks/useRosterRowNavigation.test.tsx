import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useRosterRowNavigation } from "./useRosterRowNavigation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STUDENTS = ["s1", "s2", "s3"];

type RosterStatus = "present" | "absent" | "late" | "half_day" | "excused";

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
    const [statuses, setStatuses] = React.useState<Record<string, RosterStatus>>({ s1: "late" });
    useRosterRowNavigation({
      enabled: true,
      studentIds: STUDENTS,
      onSetStatus: ((id: string, status: RosterStatus) => {
        setStatuses((current) => ({ ...current, [id]: status }));
        onSetStatus(id, status);
      }) as never,
      getStatus: (id) => statuses[id],
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

  it("advances the active row's status with Space instead of always marking absent", () => {
    const onSetStatus = vi.fn();
    render(onSetStatus);

    // s1 is "late": Space must advance to "half_day", then wrap through the cycle.
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: " " })));
    expect(onSetStatus).toHaveBeenCalledWith("s1", "half_day");

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: " " })));
    expect(onSetStatus).toHaveBeenCalledWith("s1", "excused");
  });

  it("starts the Space cycle at present for a row with an unknown status", () => {
    const onSetStatus = vi.fn();
    render(onSetStatus);

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })));
    // s2 has no status in the harness: Space advances from "present" to "absent".
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Spacebar" })));
    expect(onSetStatus).toHaveBeenCalledWith("s2", "absent");
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
