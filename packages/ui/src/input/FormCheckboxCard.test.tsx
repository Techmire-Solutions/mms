import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FormCheckboxCard } from "./FormCheckboxCard";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness(): React.JSX.Element {
  const [checked, setChecked] = React.useState(false);
  return (
    <FormCheckboxCard
      id="test-check"
      name="testCheck"
      checked={checked}
      onCheckedChange={setChecked}
      label="Test option"
    />
  );
}

describe("FormCheckboxCard", () => {
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

  it("toggles when the checkbox control is clicked", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    const box = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    expect(box).not.toBeNull();
    await act(async () => {
      box?.click();
    });
    expect(box?.getAttribute("aria-checked")).toBe("true");
  });

  it("does not double-toggle through Radix's hidden input", async () => {
    // Regression guard for the 2026-11-01 report: Radix clicks its hidden native
    // input after activation; that event used to bubble to the card's manual
    // toggle and revert the checkbox to its previous value.
    await act(async () => {
      root.render(<Harness />);
    });
    const box = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    await act(async () => {
      box?.click();
    });
    expect(box?.getAttribute("aria-checked")).toBe("true");

    // jsdom does not render Radix's hidden BubbleInput, so model the same event
    // shape: any input inside the card owns its activation and must not trigger
    // the card's manual toggle.
    const card = container.querySelector<HTMLElement>('[role="presentation"]');
    const nativeInput = document.createElement("input");
    nativeInput.type = "checkbox";
    card?.appendChild(nativeInput);
    await act(async () => {
      nativeInput.click();
    });
    expect(box?.getAttribute("aria-checked")).toBe("true");
    expect(card?.contains(nativeInput)).toBe(true);
  });

  it("surfaces the error state to assistive technology", async () => {
    await act(async () => {
      root.render(
        <FormCheckboxCard
          id="error-check"
          checked={false}
          onCheckedChange={() => undefined}
          label="Invalid option"
          error="Required"
        />,
      );
    });
    const box = container.querySelector('button[role="checkbox"]');
    expect(box?.getAttribute("aria-invalid")).toBe("true");
  });

  it("toggles when the card background is clicked", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    const card = container.querySelector<HTMLElement>('[role="presentation"]');
    await act(async () => {
      card?.click();
    });
    const box = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    expect(box?.getAttribute("aria-checked")).toBe("true");
  });
});
