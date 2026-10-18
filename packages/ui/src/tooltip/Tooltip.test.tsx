import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipArrow } from "./Tooltip";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Tooltip component - Modern Web Guidance: position-aware-tooltips", () => {
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
    document.body.innerHTML = "";
  });

  it("renders trigger button and associates with tooltip provider", async () => {
    await act(async () => {
      root.render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger asChild>
              <button type="button">Hover me</button>
            </TooltipTrigger>
            <TooltipContent>Tooltip info text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
    });

    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toBe("Hover me");

    // Radix portal renders to document.body
    const content = document.body.querySelector('[role="tooltip"]');
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain("Tooltip info text");
  });

  it("renders directional arrow when showArrow is enabled", async () => {
    await act(async () => {
      root.render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger asChild>
              <button type="button">Anchor button</button>
            </TooltipTrigger>
            <TooltipContent showArrow>Pointed advice</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
    });

    const content = document.body.querySelector('[role="tooltip"]');
    expect(content).not.toBeNull();

    // Radix arrow renders an svg inside content
    const arrow = content?.querySelector("svg");
    expect(arrow).not.toBeNull();
  });

  it("exports TooltipArrow component", () => {
    expect(TooltipArrow).toBeDefined();
  });
});
