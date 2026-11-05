import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useRovingToolbar } from "./useRovingToolbar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ dir }: { dir?: "ltr" | "rtl" }): React.JSX.Element {
  const ref = useRovingToolbar<HTMLDivElement>({ selector: "button" });
  return (
    <div ref={ref} role="toolbar" aria-label="Probe" dir={dir}>
      <button type="button">One</button>
      <button type="button">Two</button>
      <button type="button" disabled>
        Disabled
      </button>
      <button type="button">Three</button>
    </div>
  );
}

describe("useRovingToolbar", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const buttons = (): HTMLButtonElement[] => Array.from(container.querySelectorAll("button"));

  it("keeps one tab stop and skips disabled actions", async () => {
    await act(async () => {
      root.render(<Probe />);
    });
    const [one, two, disabled, three] = buttons();
    expect(one.tabIndex).toBe(0);
    expect(two.tabIndex).toBe(-1);
    expect(disabled.disabled).toBe(true);
    expect(three.tabIndex).toBe(-1);
  });

  it("moves focus with arrows, Home and End", async () => {
    await act(async () => {
      root.render(<Probe />);
    });
    const [one, two, , three] = buttons();
    one.focus();
    await act(async () => {
      one.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(document.activeElement).toBe(two);
    await act(async () => {
      two.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    expect(document.activeElement).toBe(three);
    await act(async () => {
      three.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    expect(document.activeElement).toBe(one);
    await act(async () => {
      one.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(document.activeElement).toBe(three);
  });

  it("swaps arrows in RTL", async () => {
    await act(async () => {
      root.render(<Probe dir="rtl" />);
    });
    const [one, two] = buttons();
    one.focus();
    await act(async () => {
      one.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(document.activeElement).toBe(two);
  });
});
