import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProgressBar } from "./ProgressBar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ProgressBar component - Modern Web Guidance: accessibility", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders role='progressbar' with numeric aria bounds", async () => {
    await act(async () => {
      root.render(<ProgressBar value={60} aria-label="Upload progress" />);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute("aria-valuenow")).toBe("60");
    expect(progress?.getAttribute("aria-valuemin")).toBe("0");
    expect(progress?.getAttribute("aria-valuemax")).toBe("100");
  });

  it("automatically falls back to string label for aria-valuetext", async () => {
    await act(async () => {
      root.render(<ProgressBar value={75} label="75% Complete" />);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute("aria-valuetext")).toBe("75% Complete");
  });

  it("formats aria-valuetext using custom formatValueText function", async () => {
    await act(async () => {
      root.render(
        <ProgressBar
          value={80}
          formatValueText={(v) => `$${v * 10} of $1,000 collected`}
          label="$800"
        />,
      );
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute("aria-valuetext")).toBe("$800 of $1,000 collected");
  });

  it("renders as decorative element without role='progressbar' when aria-hidden is true", async () => {
    await act(async () => {
      root.render(<ProgressBar value={40} aria-hidden="true" />);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress).toBeNull();
  });

  it("renders as decorative element when aria-hidden is boolean true", async () => {
    await act(async () => {
      root.render(<ProgressBar value={40} aria-hidden={true} />);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress).toBeNull();
  });

  it("clamps the reported aria-valuenow value to 0-100", async () => {
    await act(async () => {
      root.render(<ProgressBar value={-10} aria-label="Negative" />);
    });
    let progress = container.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute("aria-valuenow")).toBe("0");

    await act(async () => {
      root.render(<ProgressBar value={999} aria-label="Overflow" />);
    });
    progress = container.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute("aria-valuenow")).toBe("100");
  });
});
