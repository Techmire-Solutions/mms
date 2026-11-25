import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { scrollAndFocusFirstError } from "./formAutoScroll";

describe("scrollAndFocusFirstError", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls into view with smooth/center behavior and focuses input element directly", () => {
    const input = document.createElement("input");
    input.id = "test-field";
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    input.scrollIntoView = scrollSpy;
    input.focus = focusSpy;
    document.body.appendChild(input);

    const handled = scrollAndFocusFirstError(["test-field"]);
    expect(handled).toBe(true);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("focuses nested interactive element if target container is not directly focusable", () => {
    const container = document.createElement("div");
    container.id = "test-container";
    const nestedSelect = document.createElement("select");
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    container.scrollIntoView = scrollSpy;
    nestedSelect.focus = focusSpy;
    container.appendChild(nestedSelect);
    document.body.appendChild(container);

    scrollAndFocusFirstError(["non-existent", "test-container"]);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("falls back to element with aria-invalid='true' if candidates are not found", () => {
    const invalidInput = document.createElement("input");
    invalidInput.setAttribute("aria-invalid", "true");
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    invalidInput.scrollIntoView = scrollSpy;
    invalidInput.focus = focusSpy;
    document.body.appendChild(invalidInput);

    scrollAndFocusFirstError(["missing-1", "missing-2"]);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });
});
