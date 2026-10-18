import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionsDialogs } from "./useSessionsDialogs";
import type { Session } from "@/lib/data/sessionsData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSession: Session = {
  id: "ses-1",
  name: "Spring 2026",
  type: "Hifz",
  status: "active",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  baseFee: 200,
  currency: "USD",
  classes: [],
  faculty: [],
};

describe("useSessionsDialogs Hook", () => {
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

  function renderHook(onDeleteConfirm?: (id: string, reason?: string) => void) {
    let current!: ReturnType<typeof useSessionsDialogs>;
    function TestComponent() {
      current = useSessionsDialogs(onDeleteConfirm);
      return null;
    }
    return {
      render: async () => {
        await act(async () => {
          root.render(<TestComponent />);
        });
      },
      getCurrent: () => current,
    };
  }

  it("initializes with default closed dialog states", async () => {
    const { render, getCurrent } = renderHook();
    await render();

    const state = getCurrent();
    expect(state.showForm).toBe(false);
    expect(state.editSession).toBeNull();
    expect(state.detailSession).toBeNull();
    expect(state.confirmBulkDeleteOpen).toBe(false);
    expect(state.confirmBulkRestoreOpen).toBe(false);
    expect(state.pendingDeleteId).toBeNull();
  });

  it("handles create, edit, and close form transitions", async () => {
    const { render, getCurrent } = renderHook();
    await render();

    await act(async () => {
      getCurrent().openCreateForm();
    });
    expect(getCurrent().showForm).toBe(true);
    expect(getCurrent().editSession).toBeNull();

    await act(async () => {
      getCurrent().openEditForm(mockSession);
    });
    expect(getCurrent().showForm).toBe(true);
    expect(getCurrent().editSession).toBe(mockSession);

    await act(async () => {
      getCurrent().closeForm();
    });
    expect(getCurrent().showForm).toBe(false);
    expect(getCurrent().editSession).toBeNull();
  });

  it("invokes onDeleteConfirm and resets pendingDeleteId on confirmDelete", async () => {
    const onDeleteConfirm = vi.fn();
    const { render, getCurrent } = renderHook(onDeleteConfirm);
    await render();

    await act(async () => {
      getCurrent().setPendingDeleteId("ses-1");
    });
    expect(getCurrent().pendingDeleteId).toBe("ses-1");

    await act(async () => {
      getCurrent().confirmDelete("Completed session");
    });

    expect(onDeleteConfirm).toHaveBeenCalledWith("ses-1", "Completed session");
    expect(getCurrent().pendingDeleteId).toBeNull();
  });
});
