import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardSnapshotPrintState } from "./useDashboardSnapshotPrintState";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type State = ReturnType<typeof useDashboardSnapshotPrintState>;
let latest: State | undefined;

function Probe(): null {
  latest = useDashboardSnapshotPrintState();
  return null;
}

describe("useDashboardSnapshotPrintState", () => {
  let container: HTMLDivElement;
  let root: Root;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    latest = undefined;
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    Object.defineProperty(window, "print", { value: vi.fn(), writable: true, configurable: true });
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

  const flushFrame = () => {
    act(() => {
      for (const callback of frames) callback(0);
    });
    frames = [];
  };

  it("expands both groups for the snapshot and restores them afterwards", () => {
    expect(latest?.showAllMetrics).toBe(false);
    expect(latest?.showInsights).toBe(false);

    act(() => latest?.printSnapshot());
    expect(latest?.showAllMetrics).toBe(true);
    expect(latest?.showInsights).toBe(true);

    flushFrame();
    act(() => window.dispatchEvent(new Event("afterprint")));

    expect(latest?.showAllMetrics).toBe(false);
    expect(latest?.showInsights).toBe(false);
  });

  it("restores the pre-print state instead of always collapsing", () => {
    act(() => latest?.setShowInsights(true));
    expect(latest?.showInsights).toBe(true);

    act(() => latest?.printSnapshot());
    flushFrame();
    act(() => window.dispatchEvent(new Event("afterprint")));

    expect(latest?.showInsights).toBe(true);
    expect(latest?.showAllMetrics).toBe(false);
  });
});
