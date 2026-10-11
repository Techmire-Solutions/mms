import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useUnsavedChangesGuard Hook", () => {
  let container: HTMLDivElement;
  let root: Root;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("does not attach beforeunload listener when isDirty is false", () => {
    function TestComponent() {
      useUnsavedChangesGuard({ isDirty: false });
      return null;
    }

    act(() => {
      root.render(React.createElement(TestComponent));
    });

    expect(addEventListenerSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("attaches beforeunload listener when isDirty is true", () => {
    function TestComponent() {
      useUnsavedChangesGuard({ isDirty: true });
      return null;
    }

    act(() => {
      root.render(React.createElement(TestComponent));
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("removes beforeunload listener on unmount", async () => {
    function TestComponent() {
      useUnsavedChangesGuard({ isDirty: true });
      return null;
    }

    act(() => {
      root.render(React.createElement(TestComponent));
    });

    await act(async () => {
      root.unmount();
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
