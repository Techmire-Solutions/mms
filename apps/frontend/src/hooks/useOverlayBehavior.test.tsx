import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOverlayBehavior } from "./useOverlayBehavior";
import { overlayLayerCount } from "@/lib/overlayStack";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface OverlayProps {
  onClose: () => void;
  open?: boolean;
}

/** Minimal consumer of the shared overlay behaviour, mirroring Modal/Drawer. */
function Overlay({ onClose, open = true }: OverlayProps): React.JSX.Element {
  const ref = useOverlayBehavior<HTMLDivElement>({ open, onClose });
  return (
    <div ref={ref} data-testid="overlay-panel">
      <button type="button" data-testid="overlay-action">
        action
      </button>
    </div>
  );
}

function pressEscape(): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

describe("useOverlayBehavior — Escape ownership", () => {
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
    // The registry is module-level; a leaked layer would silently break the
    // "topmost only" guarantee in the next test.
    expect(overlayLayerCount()).toBe(0);
  });

  it("closes a single overlay on Escape", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<Overlay onClose={onClose} />);
    });

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only the topmost overlay when two are stacked", async () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();

    await act(async () => {
      root.render(
        <>
          <Overlay onClose={onOuterClose} />
          <Overlay onClose={onInnerClose} />
        </>,
      );
    });

    expect(overlayLayerCount()).toBe(2);

    pressEscape();

    // Regression: this used to call BOTH handlers, so dismissing a confirm
    // dialog nested in a detail drawer also dismissed the drawer.
    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("closes only the topmost when focus has fallen back to <body>", async () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();

    await act(async () => {
      root.render(
        <>
          <Overlay onClose={onOuterClose} />
          <Overlay onClose={onInnerClose} />
        </>,
      );
    });

    // Clicking inert chrome (or a Radix layer tearing down) leaves activeElement
    // on <body>, which defeats the focus-ownership guard — the layer registry is
    // what keeps Escape single-target in that case.
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    pressEscape();

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("hands Escape back to the layer underneath once the top one closes", async () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();

    function Stack(): React.JSX.Element {
      const [innerOpen, setInnerOpen] = React.useState(true);
      return (
        <>
          <Overlay onClose={onOuterClose} />
          {innerOpen ? (
            <Overlay
              onClose={() => {
                onInnerClose();
                setInnerOpen(false);
              }}
            />
          ) : null}
        </>
      );
    }

    await act(async () => {
      root.render(<Stack />);
    });

    pressEscape();
    expect(onInnerClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
    });
    expect(overlayLayerCount()).toBe(1);

    pressEscape();
    expect(onOuterClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while a portalled layer (Radix dialog) owns focus", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<Overlay onClose={onClose} />);
    });

    // Simulate Radix portalling dialog content to <body> and focusing it.
    const portal = document.createElement("div");
    const portalButton = document.createElement("button");
    portal.appendChild(portalButton);
    document.body.appendChild(portal);

    act(() => {
      portalButton.focus();
    });

    pressEscape();
    expect(onClose).not.toHaveBeenCalled();

    // Once focus returns to the overlay, Escape works again.
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="overlay-action"]')?.focus();
    });
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);

    portal.remove();
  });

  it("still closes when nothing holds focus (focus fell back to <body>)", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<Overlay onClose={onClose} />);
    });

    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not register a layer while closed", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<Overlay onClose={onClose} open={false} />);
    });

    expect(overlayLayerCount()).toBe(0);
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });
});
