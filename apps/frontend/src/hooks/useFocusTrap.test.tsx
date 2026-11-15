import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 10,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 10,
  });
  void originalOffsetWidth;
});

function Trap({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div ref={ref} data-testid="trap">
      <button type="button" id="first">
        first
      </button>
      <button type="button" id="last">
        last
      </button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first control, wraps Tab, and restores focus on unmount", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.appendChild(trigger);
    trigger.focus();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Trap active />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.activeElement?.id).toBe("first");

    const last = document.querySelector<HTMLButtonElement>("#last");
    last?.focus();
    await act(async () => {
      document
        .querySelector("[data-testid='trap']")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement?.id).toBe("first");

    const first = document.querySelector<HTMLButtonElement>("#first");
    first?.focus();
    await act(async () => {
      document
        .querySelector("[data-testid='trap']")
        ?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
        );
    });
    expect(document.activeElement?.id).toBe("last");

    await act(async () => root.unmount());
    expect(document.activeElement).toBe(trigger);

    container.remove();
    trigger.remove();
  });
});
