import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDirectoryTrashState } from "@mms/fe-core/lib/useDirectoryTrashState";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useDirectoryTrashState", () => {
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
  });

  function renderHook(initialEntries: string[] = ["/"]) {
    let viewingDeleted!: boolean;
    let setViewingDeleted!: (show: boolean) => void;
    let currentSearch = "";

    function TestComponent() {
      const [viewing, setViewing] = useDirectoryTrashState();
      viewingDeleted = viewing;
      setViewingDeleted = setViewing;
      currentSearch = useLocation().search;
      return null;
    }

    act(() => {
      root.render(
        <MemoryRouter initialEntries={initialEntries}>
          <TestComponent />
        </MemoryRouter>,
      );
    });

    return {
      get viewingDeleted() {
        return viewingDeleted;
      },
      setViewingDeleted,
      get search() {
        return currentSearch;
      },
    };
  }

  it("defaults to viewingDeleted = false when no search params present", () => {
    const hook = renderHook();
    expect(hook.viewingDeleted).toBe(false);
  });

  it("initializes viewingDeleted = true when view=trash is present", () => {
    const hook = renderHook(["/?view=trash"]);
    expect(hook.viewingDeleted).toBe(true);
  });

  it("initializes viewingDeleted = true when archived=true is present", () => {
    const hook = renderHook(["/?archived=true"]);
    expect(hook.viewingDeleted).toBe(true);
  });

  it("preserves active query parameters when toggling to trash mode (§7.10)", () => {
    const hook = renderHook(["/?q=test&gender=male"]);
    expect(hook.viewingDeleted).toBe(false);

    act(() => {
      hook.setViewingDeleted(true);
    });

    expect(hook.viewingDeleted).toBe(true);
    expect(hook.search).toContain("view=trash");
    expect(hook.search).toContain("q=test");
    expect(hook.search).toContain("gender=male");
  });

  it("removes view and archived params when toggling back to active mode", () => {
    const hook = renderHook(["/?view=trash&archived=true&page=2"]);
    expect(hook.viewingDeleted).toBe(true);

    act(() => {
      hook.setViewingDeleted(false);
    });

    expect(hook.viewingDeleted).toBe(false);
    expect(hook.search).not.toContain("view=trash");
    expect(hook.search).not.toContain("archived=true");
    expect(hook.search).toContain("page=2");
  });
});
