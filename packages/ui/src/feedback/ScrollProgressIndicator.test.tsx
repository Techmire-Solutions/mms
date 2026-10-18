import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ScrollProgressIndicator } from "./ScrollProgressIndicator";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ScrollProgressIndicator component", () => {
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

  it("renders with aria-hidden='true' to keep purely decorative bar out of assistive tree", async () => {
    await act(async () => {
      root.render(<ScrollProgressIndicator />);
    });

    const indicator = container.querySelector("div");
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies fixed positioning and scroll-progress-bar utility class", async () => {
    await act(async () => {
      root.render(<ScrollProgressIndicator className="custom-indicator" />);
    });

    const indicator = container.querySelector("div");
    expect(indicator?.className).toContain("fixed");
    expect(indicator?.className).toContain("scroll-progress-bar");
    expect(indicator?.className).toContain("custom-indicator");
  });
});
