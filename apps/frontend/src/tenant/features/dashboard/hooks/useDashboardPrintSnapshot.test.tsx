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
  let cancelledFrames: Set<number>;

  const flushFrames = () => {
    frameQueue.forEach((callback, index) => {
      if (!cancelledFrames.has(index + 1)) callback(0);
    });
  };

  beforeEach(() => {
    expand.mockReset();
    restore.mockReset();
    frameQueue = [];
    cancelledFrames = new Set();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameQueue.push(callback);
      return frameQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      cancelledFrames.add(id);
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
      flushFrames();
    });
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("cancels the deferred print when the caller unmounts before the frame fires", async () => {
    act(() => printSnapshot());
    expect(expand).toHaveBeenCalledTimes(1);
    expect(printSpy).not.toHaveBeenCalled();

    await act(async () => root.unmount());

    act(() => {
      flushFrames();
    });
    // The frame was cancelled on unmount: no print dialog for a page the user left.
    expect(printSpy).not.toHaveBeenCalled();
    // The unmount cleanup still released the one-shot afterprint listener.
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("restores the on-screen state after the print dialog closes", () => {
    act(() => printSnapshot());
    expect(restore).not.toHaveBeenCalled();

    act(() => {
      flushFrames();
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
