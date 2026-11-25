import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    data: undefined as { handoffUrl: string; expiresAt: string; auditId: string } | undefined,
    mutate: vi.fn(),
  },
}));

vi.mock("./hooks/useImpersonation.js", () => ({
  useImpersonation: () => ({
    mutate: state.mutate,
    isPending: false,
    isError: false,
    data: state.data,
  }),
}));

import { TenantImpersonationModal } from "./TenantImpersonationModal.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LABELS = {
  title: "Impersonate tenant user",
  reason: "Reason",
  password: "Your password",
  submit: "Start impersonation",
  cancel: "Cancel",
  sending: "Starting…",
  error: "Impersonation failed",
  success: "Impersonation link ready",
  expires: "Expires",
  done: "Done",
};

const TARGET = { tenant: "acme", userId: "u1", name: "Amina" };

let container: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(node));
}

function setInputValue(element: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(
    element,
    value,
  );
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  state.data = undefined;
  state.mutate.mockReset();
  act(() => root.unmount());
  container.remove();
});

describe("TenantImpersonationModal", () => {
  it("requires a reason and password before submitting", () => {
    render(<TenantImpersonationModal labels={LABELS} onClose={vi.fn()} open target={TARGET} />);

    expect(container.textContent).toContain("Amina");
    expect(container.textContent).toContain("acme");
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBe(true);

    const [reason, password] = Array.from(container.querySelectorAll("input"));
    setInputValue(reason, "support request for abuse");
    setInputValue(password, "secret");
    act(() =>
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );

    expect(state.mutate).toHaveBeenCalledWith({
      ...TARGET,
      reason: "support request for abuse",
      currentPassword: "secret",
    });
  });

  it("shows the one-time handoff link and the expiry instead of closing", () => {
    state.data = {
      handoffUrl: "https://acme.example/login?handoff=abc",
      expiresAt: "2026-01-01T00:00:00.000Z",
      auditId: "audit-1",
    };
    render(<TenantImpersonationModal labels={LABELS} onClose={vi.fn()} open target={TARGET} />);

    expect(container.textContent).toContain("Impersonation link ready");
    expect(container.textContent).toContain("https://acme.example/login?handoff=abc");
    expect(container.textContent).toContain("Expires");
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Done",
      ),
    ).toBe(true);
  });
});
