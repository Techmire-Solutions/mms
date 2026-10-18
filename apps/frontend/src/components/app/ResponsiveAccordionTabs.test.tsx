import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponsiveAccordionTabs } from "./ResponsiveAccordionTabs";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/routing/useScrollSurfaceOnChange", () => ({
  useScrollSurfaceOnChange: vi.fn(),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true, // Desktop mode for testing tab click
}));

describe("ResponsiveAccordionTabs", () => {
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
    vi.restoreAllMocks();
  });

  const sampleTabs = [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Details" },
  ];

  it("renders tab triggers and invokes onTabChange on selection", async () => {
    const onTabChange = vi.fn();

    await act(async () => {
      root.render(
        <ResponsiveAccordionTabs tabs={sampleTabs} activeTab="overview" onTabChange={onTabChange}>
          <div>Active Tab Content</div>
        </ResponsiveAccordionTabs>,
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);

    const detailsButton = Array.from(buttons).find((b) => b.textContent?.includes("Details"));
    expect(detailsButton).toBeDefined();

    await act(async () => {
      detailsButton?.click();
    });

    expect(onTabChange).toHaveBeenCalledWith("details");
  });

  it("handles document.startViewTransition when available", async () => {
    const transitionSpy = vi.fn((cb: () => void) => cb());
    const doc = document as unknown as { startViewTransition?: (fn: () => void) => void };
    doc.startViewTransition = transitionSpy;

    const onTabChange = vi.fn();

    await act(async () => {
      root.render(
        <ResponsiveAccordionTabs tabs={sampleTabs} activeTab="overview" onTabChange={onTabChange}>
          <div>Active Tab Content</div>
        </ResponsiveAccordionTabs>,
      );
    });

    const buttons = container.querySelectorAll("button");
    const detailsButton = Array.from(buttons).find((b) => b.textContent?.includes("Details"));

    await act(async () => {
      detailsButton?.click();
    });

    expect(transitionSpy).toHaveBeenCalled();
    expect(onTabChange).toHaveBeenCalledWith("details");

    delete doc.startViewTransition;
  });
});
