import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthTextField } from "./AuthTextField";
import { AuthEmailField } from "./AuthEmailField";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AuthTextField & AuthEmailField", () => {
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

  it("renders AuthTextField with aria-errormessage when error is present", async () => {
    await act(async () => {
      root.render(
        <AuthTextField
          id="test-input"
          label="Identifier"
          value=""
          onChange={vi.fn()}
          error="Field is required"
        />,
      );
    });

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("test-input-error");
    expect(input.getAttribute("aria-errormessage")).toBe("test-input-error");

    const errorEl = container.querySelector("#test-input-error");
    expect(errorEl?.textContent).toBe("Field is required");
    expect(errorEl?.getAttribute("role")).toBe("alert");
  });

  it("renders AuthEmailField with autoCapitalize='none', autoCorrect='off', and default enterKeyHint='next'", async () => {
    await act(async () => {
      root.render(
        <AuthEmailField
          id="email-input"
          label="Email Address"
          value="user@example.com"
          onChange={vi.fn()}
        />,
      );
    });

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe("email");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("enterkeyhint")).toBe("next");
  });
});

