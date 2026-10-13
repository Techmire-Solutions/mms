import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountProfileLoginEmailCard,
  type AccountProfileLoginEmailCardProps,
} from "./AccountProfileLoginEmailCard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function props(): AccountProfileLoginEmailCardProps {
  return {
    profile: {
      id: "user",
      loginEmail: "old@example.com",
      name: "Owner",
      role: "admin",
      workspaceSubdomain: "demo",
      contact: null,
    },
    loginVerified: true,
    newLoginEmail: "new@example.com",
    loginPassword: "Example1!",
    challengeId: null,
    verifyCode: "123456",
    devCode: null,
    loginEmailBusy: false,
    showEmailForm: true,
    onNewLoginEmailChange: vi.fn(),
    onLoginPasswordChange: vi.fn(),
    onVerifyCodeChange: vi.fn(),
    onShowEmailForm: vi.fn(),
    onCancelLoginEmailRequest: vi.fn(),
    onCancelLoginEmailConfirm: vi.fn(),
    onRequestLoginEmail: vi.fn().mockResolvedValue(undefined),
    onConfirmLoginEmail: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AccountProfileLoginEmailCard", () => {
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

  it.each([false, true])(
    "preserves submit and cancel callbacks in the challenge phase: %s",
    async (challenge) => {
      const data = props();
      if (challenge) data.challengeId = "challenge";
      await act(async () => root.render(<AccountProfileLoginEmailCard {...data} />));
      await act(async () =>
        container
          .querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      expect(
        challenge ? data.onConfirmLoginEmail : data.onRequestLoginEmail,
      ).toHaveBeenCalledOnce();
      expect(
        challenge ? data.onRequestLoginEmail : data.onConfirmLoginEmail,
      ).not.toHaveBeenCalled();
      const cancel = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "common.cancel",
      );
      await act(async () => cancel?.click());
      expect(
        challenge ? data.onCancelLoginEmailConfirm : data.onCancelLoginEmailRequest,
      ).toHaveBeenCalledOnce();
    },
  );

  it.each([false, true])(
    "keeps a labeled, disabled submit action while busy in the challenge phase: %s",
    async (challenge) => {
      const data = {
        ...props(),
        loginEmailBusy: true,
        challengeId: challenge ? "challenge" : null,
      };
      await act(async () => root.render(<AccountProfileLoginEmailCard {...data} />));
      const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(submit?.disabled).toBe(true);
      expect(submit?.textContent).toContain(
        challenge ? "account.confirmLoginEmail" : "account.sendCode",
      );
      const cancel = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "common.cancel",
      );
      expect(cancel?.disabled).toBe(true);
    },
  );

  it("associates unique field labels when two cards are mounted", async () => {
    await act(async () =>
      root.render(
        <>
          <AccountProfileLoginEmailCard {...props()} />
          <AccountProfileLoginEmailCard {...props()} />
        </>,
      ),
    );
    const inputs = Array.from(container.querySelectorAll("input"));
    expect(new Set(inputs.map((input) => input.id)).size).toBe(inputs.length);
    for (const input of inputs) {
      expect(
        Array.from(container.querySelectorAll("label")).some((label) => label.htmlFor === input.id),
      ).toBe(true);
    }
  });
});
