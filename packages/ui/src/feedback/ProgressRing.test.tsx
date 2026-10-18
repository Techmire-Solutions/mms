import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProgressRing } from "./ProgressRing";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ProgressRing component", () => {
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

  it("renders with role='progressbar' and correct aria values", async () => {
    await act(async () => {
      root.render(<ProgressRing percentage={75} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute("aria-valuenow")).toBe("75");
    expect(progressbar?.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar?.getAttribute("aria-valuemax")).toBe("100");
    expect(progressbar?.getAttribute("aria-label")).toBe("75%");
    expect(progressbar?.textContent).toContain("75%");
  });

  it("clamps percentages between 0 and 100", async () => {
    await act(async () => {
      root.render(<ProgressRing percentage={125} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute("aria-valuenow")).toBe("100");
    expect(progressbar?.textContent).toContain("100%");
  });

  it("renders compact sizing variant", async () => {
    await act(async () => {
      root.render(<ProgressRing percentage={40} isCompact />);
    });

    const progressbar = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(progressbar?.style.width).toBe("40px");
    expect(progressbar?.style.height).toBe("40px");

    const svg = progressbar?.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("40");
    expect(svg?.getAttribute("height")).toBe("40");
  });

  it("renders custom color and custom child in the center", async () => {
    await act(async () => {
      root.render(
        <ProgressRing percentage={50} colorHex="#10b981">
          <span data-testid="custom-center">Halfway</span>
        </ProgressRing>,
      );
    });

    const center = container.querySelector('[data-testid="custom-center"]');
    expect(center).not.toBeNull();
    expect(center?.textContent).toBe("Halfway");

    const progressCircle = container.querySelectorAll("circle")[1];
    expect(progressCircle?.style.stroke).toBe("#10b981");
  });

  it("supports decorative mode without progressbar role when aria-hidden is true", async () => {
    await act(async () => {
      root.render(<ProgressRing percentage={60} aria-hidden={true} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeNull();
  });
});
