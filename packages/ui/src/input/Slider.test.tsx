import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Slider } from "./Slider";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Slider component - Modern Web Guidance: slider", () => {
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

  it("renders a single thumb with role='slider' by default", async () => {
    await act(async () => {
      root.render(<Slider defaultValue={[50]} aria-label="Volume" />);
    });

    const thumbs = container.querySelectorAll('[role="slider"]');
    expect(thumbs.length).toBe(1);
    expect(thumbs[0]?.getAttribute("aria-label")).toBe("Volume");
    expect(thumbs[0]?.getAttribute("aria-valuenow")).toBe("50");
  });

  it("formats aria-valuetext using formatValueText prop", async () => {
    await act(async () => {
      root.render(
        <Slider
          defaultValue={[75]}
          formatValueText={(v) => `${v}%`}
          aria-label="Battery level"
        />,
      );
    });

    const thumb = container.querySelector('[role="slider"]');
    expect(thumb?.getAttribute("aria-valuetext")).toBe("75%");
  });

  it("renders multiple thumbs when given an array of values", async () => {
    await act(async () => {
      root.render(
        <Slider
          defaultValue={[20, 80]}
          formatValueText={(v) => `$${v}`}
          aria-label="Price range"
        />,
      );
    });

    const thumbs = container.querySelectorAll('[role="slider"]');
    expect(thumbs.length).toBe(2);
    expect(thumbs[0]?.getAttribute("aria-valuetext")).toBe("$20");
    expect(thumbs[1]?.getAttribute("aria-valuetext")).toBe("$80");
  });

  it("respects disabled state", async () => {
    await act(async () => {
      root.render(<Slider disabled defaultValue={[30]} aria-label="Zoom" />);
    });

    const thumb = container.querySelector('[role="slider"]');
    expect(thumb?.getAttribute("data-disabled")).toBe("");
  });
});
