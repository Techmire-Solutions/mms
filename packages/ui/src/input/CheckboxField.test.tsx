import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckboxField } from "./CheckboxField";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness(
  props: Partial<React.ComponentProps<typeof CheckboxField>> = {},
): React.JSX.Element {
  const [checked, setChecked] = React.useState(false);
  return (
    <CheckboxField
      id="field-check"
      checked={checked}
      onCheckedChange={setChecked}
      label="Send email"
      description="A receipt is emailed after saving."
      {...props}
    />
  );
}

describe("CheckboxField", () => {
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
    vi.restoreAllMocks();
  });

  it("associates the label and description with the checkbox", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    const box = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    const label = container.querySelector<HTMLLabelElement>('label[for="field-check"]');
    const description = container.querySelector<HTMLElement>("#field-check-description");
    expect(box).not.toBeNull();
    expect(label).not.toBeNull();
    expect(description?.textContent).toContain("A receipt is emailed");
    expect(box?.getAttribute("aria-describedby")).toBe("field-check-description");
  });

  it("toggles once when the label is clicked", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    const box = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    const label = container.querySelector<HTMLLabelElement>('label[for="field-check"]');
    await act(async () => {
      label?.click();
    });
    expect(box?.getAttribute("aria-checked")).toBe("true");
  });

  it("marks the checkbox invalid and renders the error message", async () => {
    await act(async () => {
      root.render(<Harness error="This field is required" />);
    });
    const box = container.querySelector('button[role="checkbox"]');
    expect(box?.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("This field is required");
  });
});
