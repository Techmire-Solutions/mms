import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClampedNumberField } from "./useClampedNumberField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useClampedNumberField", () => {
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

  function Harness({ onChange }: { onChange: (value: number) => void }) {
    const field = useClampedNumberField({ value: 75, min: 1, max: 100, onChange });
    return (
      <input
        aria-label="threshold"
        value={field.text}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onChange={(event) => field.setText(event.target.value)}
      />
    );
  }

  function input(): HTMLInputElement {
    return container.querySelector("input") as HTMLInputElement;
  }

  /** React tracks its own value; the native setter is what makes a synthetic change stick. */
  function setValue(field: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("clamps an out-of-range value on blur", async () => {
    const onChange = vi.fn();
    await act(async () => root.render(<Harness onChange={onChange} />));
    const field = input();
    await act(async () => {
      field.focus();
      setValue(field, "150");
    });
    await act(async () => field.blur());
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("restores the previous value when the field is cleared", async () => {
    const onChange = vi.fn();
    await act(async () => root.render(<Harness onChange={onChange} />));
    const field = input();
    await act(async () => {
      field.focus();
      setValue(field, "");
    });
    await act(async () => field.blur());
    // Never commits 0 (Number("")), which used to flag every student.
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("75");
  });
});
