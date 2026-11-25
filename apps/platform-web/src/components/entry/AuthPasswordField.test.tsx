import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPasswordField } from "./AuthPasswordField";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AuthPasswordField", () => {
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

  it("renders with aria-errormessage when error is present", async () => {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <AuthPasswordField
            id="password-input"
            label="Password"
            value="secret123"
            onChange={vi.fn()}
            error="Invalid password"
          />
        </BrowserRouter>,
      );
    });

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe("password");
    expect(input.getAttribute("enterkeyhint")).toBe("go");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("password-input-error");
    expect(input.getAttribute("aria-errormessage")).toBe("password-input-error");

    const errorEl = container.querySelector("#password-input-error");
    expect(errorEl?.textContent).toBe("Invalid password");
    expect(errorEl?.getAttribute("role")).toBe("alert");
  });

  it("toggles password visibility with accessible aria-pressed state", async () => {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <AuthPasswordField
            id="password-toggle-test"
            label="Password"
            value="secret123"
            onChange={vi.fn()}
          />
        </BrowserRouter>,
      );
    });

    const input = container.querySelector("input") as HTMLInputElement;
    const toggleBtn = container.querySelector("button[type='button']") as HTMLButtonElement;
    expect(input.type).toBe("password");
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      toggleBtn.click();
    });

    expect(input.type).toBe("text");
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders forgot password link when props are provided", async () => {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <AuthPasswordField
            id="pwd-forgot"
            label="Password"
            value=""
            onChange={vi.fn()}
            forgotPasswordTo="/forgot-password"
            forgotPasswordLabel="Forgot password?"
          />
        </BrowserRouter>,
      );
    });

    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/forgot-password");
    expect(link?.textContent).toBe("Forgot password?");
  });
});
