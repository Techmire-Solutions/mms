import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useColumnHeaderDrag } from "./useColumnHeaderDrag";

function renderHook(options: Parameters<typeof useColumnHeaderDrag>[0]) {
  let hookResult!: ReturnType<typeof useColumnHeaderDrag>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useColumnHeaderDrag(options);
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get result() {
      return hookResult;
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useColumnHeaderDrag", () => {
  const columns = [
    { id: "name", label: "Name" },
    { id: "gender", label: "Gender" },
    { id: "phone", label: "Phone" },
    { id: "email", label: "Email" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks sticky column as non-draggable and other columns as draggable", () => {
    const onReorder = vi.fn();
    const harness = renderHook({
      columns,
      stickyColumnId: "name",
      onReorder,
    });

    expect(harness.result.canDrag("name")).toBe(false);
    expect(harness.result.canDrag("gender")).toBe(true);
    expect(harness.result.canDrag("phone")).toBe(true);
    expect(harness.result.canDrag("email")).toBe(true);

    harness.cleanup();
  });

  it("disables dragging when onReorder is not provided", () => {
    const harness = renderHook({
      columns,
      stickyColumnId: "name",
    });

    expect(harness.result.canDrag("gender")).toBe(false);

    harness.cleanup();
  });

  it("returns appropriate drag props with grab cursor for draggable columns", () => {
    const onReorder = vi.fn();
    const harness = renderHook({
      columns,
      stickyColumnId: "name",
      onReorder,
    });

    const nameProps = harness.result.getThDragProps("name", "Name");
    const genderProps = harness.result.getThDragProps("gender", "Gender");

    expect(nameProps.onPointerDown).toBeUndefined();
    expect(nameProps.className).not.toContain("cursor-grab");

    expect(typeof genderProps.onPointerDown).toBe("function");
    expect(genderProps.className).toContain("cursor-grab");

    harness.cleanup();
  });

  it("respects custom isColumnDraggable filter", () => {
    const onReorder = vi.fn();
    const harness = renderHook({
      columns,
      stickyColumnId: "name",
      onReorder,
      isColumnDraggable: (id) => id !== "phone",
    });

    expect(harness.result.canDrag("name")).toBe(false);
    expect(harness.result.canDrag("gender")).toBe(true);
    expect(harness.result.canDrag("phone")).toBe(false);

    harness.cleanup();
  });
});
