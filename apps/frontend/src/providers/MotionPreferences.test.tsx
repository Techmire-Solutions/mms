import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionPreferences } from "./MotionPreferences";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("framer-motion", () => ({
  MotionConfig: ({
    children,
    reducedMotion,
  }: {
    children: React.ReactNode;
    reducedMotion?: string;
  }) => (
    <div data-testid="motion-config" data-reduced-motion={reducedMotion}>
      {children}
    </div>
  ),
}));

describe("MotionPreferences", () => {
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

  it("given the authenticated shell mounts, should apply the OS reduced-motion setting to its subtree", async () => {
    // Act
    await act(async () => {
      root.render(
        <MotionPreferences>
          <span>shell content</span>
        </MotionPreferences>,
      );
    });

    // Assert
    const config = container.querySelector('[data-testid="motion-config"]');
    expect(config?.getAttribute("data-reduced-motion")).toBe("user");
    expect(config?.textContent).toContain("shell content");
  });
});
