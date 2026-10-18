import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OtpInput, createEmptyOtp, isOtpComplete } from "./OtpInput";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("OtpInput component", () => {
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
    vi.restoreAllMocks();
  });

  it("renders 6 digit inputs with autocomplete='one-time-code' on the first input", async () => {
    const value = createEmptyOtp(6);
    await act(async () => {
      root.render(<OtpInput value={value} onChange={vi.fn()} ariaLabel="Verification Code" />);
    });

    const inputs = container.querySelectorAll("input");
    expect(inputs.length).toBe(6);
    expect(inputs[0]?.getAttribute("autocomplete")).toBe("one-time-code");
    expect(inputs[1]?.getAttribute("autocomplete")).toBe("off");
    expect(inputs[0]?.getAttribute("inputmode")).toBe("numeric");
  });

  function setInputValue(element: HTMLInputElement, val: string): void {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(element, val);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("handles single-digit input entry", async () => {
    const onChange = vi.fn();
    const value = createEmptyOtp(6);

    await act(async () => {
      root.render(<OtpInput value={value} onChange={onChange} ariaLabel="Verification Code" />);
    });

    const inputs = container.querySelectorAll("input");
    const firstInput = inputs[0] as HTMLInputElement;

    await act(async () => {
      setInputValue(firstInput, "7");
    });

    expect(onChange).toHaveBeenCalledWith(["7", "", "", "", "", ""]);
  });

  it("handles multi-character SMS OTP autofill into the first input", async () => {
    const onChange = vi.fn();
    const value = createEmptyOtp(6);

    await act(async () => {
      root.render(<OtpInput value={value} onChange={onChange} ariaLabel="Verification Code" />);
    });

    const inputs = container.querySelectorAll("input");
    const firstInput = inputs[0] as HTMLInputElement;

    await act(async () => {
      // Simulate mobile browser autofilling all 6 digits into the active field
      setInputValue(firstInput, "849201");
    });

    expect(onChange).toHaveBeenCalledWith(["8", "4", "9", "2", "0", "1"]);
  });

  it("handles paste event across boxes", async () => {
    const onChange = vi.fn();
    const value = createEmptyOtp(6);

    await act(async () => {
      root.render(<OtpInput value={value} onChange={onChange} ariaLabel="Verification Code" />);
    });

    const inputs = container.querySelectorAll("input");
    const firstInput = inputs[0] as HTMLInputElement;

    await act(async () => {
      const pasteEvent = new Event("paste", { bubbles: true }) as any;
      pasteEvent.clipboardData = {
        getData: (type: string) => (type === "text" ? "123456" : ""),
      };
      firstInput.dispatchEvent(pasteEvent);
    });

    expect(onChange).toHaveBeenCalledWith(["1", "2", "3", "4", "5", "6"]);
  });

  it("evaluates isOtpComplete accurately", () => {
    expect(isOtpComplete(["1", "2", "3", "4", "5", "6"])).toBe(true);
    expect(isOtpComplete(["1", "2", "3", "4", "5", ""])).toBe(false);
    expect(isOtpComplete(["1", "2", "3"])).toBe(false);
  });
});
