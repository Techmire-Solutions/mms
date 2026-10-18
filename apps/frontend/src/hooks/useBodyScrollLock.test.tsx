import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBodyScrollLock } from "./useBodyScrollLock";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function TestModal({ active = true }: { active?: boolean }): React.JSX.Element {
  useBodyScrollLock(active);
  return <div data-testid="modal">Modal Content</div>;
}

describe("useBodyScrollLock", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    document.body.style.overflow = "";
    document.body.style.paddingInlineEnd = "";
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.style.overflow = "";
    document.body.style.paddingInlineEnd = "";
    vi.restoreAllMocks();
  });

  it("locks body scrolling when mounted and restores when unmounted", async () => {
    expect(document.body.style.overflow).toBe("");

    await act(async () => {
      root.render(<TestModal active={true} />);
    });

    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      root.render(<div />);
    });

    expect(document.body.style.overflow).toBe("");
  });

  it("handles stacked modals via reference counting", async () => {
    function StackedModals({ showSecond }: { showSecond: boolean }): React.JSX.Element {
      return (
        <div>
          <TestModal active={true} />
          {showSecond && <TestModal active={true} />}
        </div>
      );
    }

    await act(async () => {
      root.render(<StackedModals showSecond={true} />);
    });

    expect(document.body.style.overflow).toBe("hidden");

    // Unmount second modal; first modal is still active
    await act(async () => {
      root.render(<StackedModals showSecond={false} />);
    });

    expect(document.body.style.overflow).toBe("hidden");

    // Unmount all modals
    await act(async () => {
      root.render(<div />);
    });

    expect(document.body.style.overflow).toBe("");
  });

  it("does not lock scroll when active is false", async () => {
    await act(async () => {
      root.render(<TestModal active={false} />);
    });

    expect(document.body.style.overflow).toBe("");
  });

  it("skips manual padding compensation when CSS scrollbar-gutter is natively supported", async () => {
    const cssSpy = vi.spyOn(window.CSS, "supports").mockImplementation(((...args: string[]) => {
      const [prop, val] = args;
      if (prop === "scrollbar-gutter" && val === "stable") return true;
      return false;
    }) as typeof window.CSS.supports);

    await act(async () => {
      root.render(<TestModal active={true} />);
    });

    expect(document.body.style.overflow).toBe("hidden");
    // With native gutter support, paddingInlineEnd is not manually touched
    expect(document.body.style.paddingInlineEnd).toBe("");

    cssSpy.mockRestore();
  });
});
