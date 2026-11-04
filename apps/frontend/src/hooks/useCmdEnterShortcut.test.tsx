import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCmdEnterShortcut } from "./useCmdEnterShortcut";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Host(props: {
  onTrigger: () => void;
  enabled?: boolean;
  allowTyping?: boolean;
}): React.JSX.Element {
  useCmdEnterShortcut({
    enabled: props.enabled ?? true,
    onTrigger: props.onTrigger,
    allowTyping: props.allowTyping,
  });
  return <input aria-label="field" />;
}

function pressEnter(init: KeyboardEventInit = {}): void {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    metaKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
}

describe("useCmdEnterShortcut", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll("[role='alertdialog']").forEach((node) => node.remove());
  });

  function renderHost(props: Parameters<typeof Host>[0]): void {
    act(() => {
      root.render(<Host {...props} />);
    });
  }

  it("triggers on Cmd/Ctrl+Enter", () => {
    const onTrigger = vi.fn();
    renderHost({ onTrigger });

    act(() => pressEnter());

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("does nothing while a confirmation dialog is open", () => {
    const onTrigger = vi.fn();
    renderHost({ onTrigger });

    const confirm = document.createElement("div");
    confirm.setAttribute("role", "alertdialog");
    document.body.appendChild(confirm);

    act(() => pressEnter());

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("ignores typing targets when allowTyping is false", () => {
    const onTrigger = vi.fn();
    renderHost({ onTrigger, allowTyping: false });

    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onTrigger).not.toHaveBeenCalled();

    act(() => pressEnter());
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("does not register while disabled", () => {
    const onTrigger = vi.fn();
    renderHost({ onTrigger, enabled: false });

    act(() => pressEnter());

    expect(onTrigger).not.toHaveBeenCalled();
  });
});
