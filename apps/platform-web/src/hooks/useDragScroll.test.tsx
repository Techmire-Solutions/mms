import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDragScroll } from "@mms/ui/app/useDragScroll";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Strip({ onTab }: { onTab: () => void }): React.JSX.Element {
  const ref = useDragScroll<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="strip">
      <button type="button" onClick={onTab}>
        Tab
      </button>
    </div>
  );
}

function pointer(type: string, init: { clientX: number; pointerType?: string; button?: number }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

describe("useDragScroll", () => {
  let container: HTMLDivElement;
  let root: Root;
  let strip: HTMLDivElement;
  const onTab = vi.fn();

  beforeEach(async () => {
    onTab.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Strip onTab={onTab} />);
    });
    strip = container.querySelector('[data-testid="strip"]') as HTMLDivElement;
    Object.defineProperty(strip, "scrollWidth", { value: 600, configurable: true });
    Object.defineProperty(strip, "clientWidth", { value: 200, configurable: true });
    strip.scrollLeft = 100;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("scrolls the strip when the mouse drags past the threshold and swallows the trailing click", () => {
    const tab = strip.querySelector("button") as HTMLButtonElement;
    tab.dispatchEvent(pointer("pointerdown", { clientX: 150, button: 0 }));
    strip.dispatchEvent(pointer("pointermove", { clientX: 110 }));
    expect(strip.scrollLeft).toBe(140);
    strip.dispatchEvent(pointer("pointerup", { clientX: 110 }));
    tab.click();
    expect(onTab).not.toHaveBeenCalled();
    // The suppression is one-shot: the next real click still activates the tab.
    tab.click();
    expect(onTab).toHaveBeenCalledTimes(1);
  });

  it("treats a small jitter as a click, not a drag", () => {
    const tab = strip.querySelector("button") as HTMLButtonElement;
    tab.dispatchEvent(pointer("pointerdown", { clientX: 150, button: 0 }));
    strip.dispatchEvent(pointer("pointermove", { clientX: 148 }));
    strip.dispatchEvent(pointer("pointerup", { clientX: 148 }));
    tab.click();
    expect(strip.scrollLeft).toBe(100);
    expect(onTab).toHaveBeenCalledTimes(1);
  });

  it("leaves touch and pen input to native scrolling", () => {
    strip.dispatchEvent(pointer("pointerdown", { clientX: 150, button: 0, pointerType: "touch" }));
    strip.dispatchEvent(pointer("pointermove", { clientX: 50, pointerType: "touch" }));
    expect(strip.scrollLeft).toBe(100);
  });

  it("maps a vertical mouse wheel to horizontal scroll when the strip overflows sideways", () => {
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy;
    const wheel = new WheelEvent("wheel", { deltaY: 80, bubbles: true, cancelable: true });
    strip.dispatchEvent(wheel);
    expect(scrollBy).toHaveBeenCalledWith({ left: 80 });
    expect(wheel.defaultPrevented).toBe(true);
  });

  it("does nothing when the strip does not overflow", () => {
    Object.defineProperty(strip, "scrollWidth", { value: 200, configurable: true });
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy;
    const wheel = new WheelEvent("wheel", { deltaY: 80, bubbles: true, cancelable: true });
    strip.dispatchEvent(wheel);
    strip.dispatchEvent(pointer("pointerdown", { clientX: 150, button: 0 }));
    strip.dispatchEvent(pointer("pointermove", { clientX: 50 }));
    expect(scrollBy).not.toHaveBeenCalled();
    expect(wheel.defaultPrevented).toBe(false);
    expect(strip.scrollLeft).toBe(100);
  });
});
