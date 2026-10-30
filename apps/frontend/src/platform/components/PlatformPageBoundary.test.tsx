import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformPageBoundary } from "./PlatformPageShell";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Boom(): React.JSX.Element {
  throw new Error("page render failed");
}

describe("PlatformPageBoundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  it("given a page that throws, should replace only that page while the rest of the shell stays mounted", async () => {
    // Arrange
    const render = (
      <div>
        <span>shell-navigation</span>
        <PlatformPageBoundary>
          <Boom />
        </PlatformPageBoundary>
      </div>
    );

    // Act
    await act(async () => {
      root.render(render);
    });

    // Assert
    expect(container.textContent).toContain("shell-navigation");
    await vi.waitFor(() => {
      expect(container.textContent).toContain("page render failed");
    });
  });
});
