import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardPrintSnapshot } from "./useDashboardPrintSnapshot";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const expand = vi.fn();
const restore = vi.fn();
let printSnapshot: () => void = () => {};

function Probe(): null {
  printSnapshot = useDashboardPrintSnapshot(expand, restore);
  return null;
}

describe("useDashboardPrintSnapshot", () => {
  let container: HTMLDivElement;
  let root: Root;
  let printSpy: ReturnType<typeof vi.fn>;
  let frameQueue: FrameRequestCallback[];

  beforeEach(() => {
    expand.mockReset();
    restore.mockReset();
    frameQueue = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameQueue.push(callback);
      return frameQueue.length;
    });
    printSpy = vi.fn();
    Object.defineProperty(window, "print", {
      value: printSpy,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("expands the snapshot first and prints only after the layout commits", () => {
    act(() => printSnapshot());

    expect(expand).toHaveBeenCalledTimes(1);
    // Printing in the same tick would capture the collapsed view.
    expect(printSpy).not.toHaveBeenCalled();

    act(() => {
      for (const callback of frameQueue) callback(0);
    });
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("restores the on-screen state after the print dialog closes", () => {
    act(() => printSnapshot());
    expect(restore).not.toHaveBeenCalled();

    act(() => {
      for (const callback of frameQueue) callback(0);
    });
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });

    expect(restore).toHaveBeenCalledTimes(1);

    // The listener is one-shot: a later afterprint must not restore again.
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
