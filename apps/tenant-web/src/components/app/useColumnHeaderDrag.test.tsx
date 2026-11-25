import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useColumnHeaderDrag } from "@mms/fe-core/components/useColumnHeaderDrag";

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
      pinnedColumnIds: new Set(["name"]),
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
      pinnedColumnIds: new Set(["name"]),
    });

    expect(harness.result.canDrag("gender")).toBe(false);

    harness.cleanup();
  });

  it("returns appropriate drag props with grab cursor for draggable columns", () => {
    const onReorder = vi.fn();
    const harness = renderHook({
      columns,
      pinnedColumnIds: new Set(["name"]),
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
      pinnedColumnIds: new Set(["name"]),
      onReorder,
      isColumnDraggable: (id) => id !== "phone",
    });

    expect(harness.result.canDrag("name")).toBe(false);
    expect(harness.result.canDrag("gender")).toBe(true);
    expect(harness.result.canDrag("phone")).toBe(false);

    harness.cleanup();
  });

  it("handles pointer drag, activation threshold, drop targets, and reordering", async () => {
    const onReorder = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let hookResult!: ReturnType<typeof useColumnHeaderDrag>;
    function InteractiveComponent() {
      hookResult = useColumnHeaderDrag({
        columns,
        pinnedColumnIds: new Set(["name"]),
        onReorder,
      });
      return (
        <div>
          {hookResult.renderDragOverlay()}
          <table>
            <thead>
              <tr>
                <th id="th-name" {...hookResult.getThDragProps("name", "Name")}>
                  Name
                  {hookResult.renderDropIndicator("name")}
                </th>
                <th id="th-gender" {...hookResult.getThDragProps("gender", "Gender")}>
                  Gender
                  <button id="resizer-btn" role="separator" className="cursor-col-resize">
                    resize
                  </button>
                  {hookResult.renderDropIndicator("gender")}
                </th>
                <th id="th-phone" {...hookResult.getThDragProps("phone", "Phone")}>
                  Phone
                  {hookResult.renderDropIndicator("phone")}
                </th>
              </tr>
            </thead>
          </table>
        </div>
      );
    }

    act(() => {
      root.render(<InteractiveComponent />);
    });

    const thGender = container.querySelector("#th-gender") as HTMLElement;
    const thPhone = container.querySelector("#th-phone") as HTMLElement;
    const resizerBtn = container.querySelector("#resizer-btn") as HTMLElement;

    // 1. Right click should not start drag
    act(() => {
      thGender.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
          button: 2,
        }),
      );
    });
    expect(hookResult.isDragging).toBe(false);

    // 2. Click on resize handle should not start drag
    act(() => {
      resizerBtn.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
          button: 0,
        }),
      );
    });
    expect(hookResult.isDragging).toBe(false);

    // 3. Normal pointerdown on gender
    act(() => {
      thGender.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
          button: 0,
        }),
      );
    });
    // Not dragging yet until activation distance
    expect(hookResult.isDragging).toBe(false);

    // 4. Move less than activation distance (< 5px)
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 12, clientY: 12 }));
    });
    expect(hookResult.isDragging).toBe(false);

    // Mock elementFromPoint and getBoundingClientRect for thPhone
    const originalElementFromPoint = document.elementFromPoint;
    thPhone.getBoundingClientRect = () => ({
      left: 100,
      width: 100,
      right: 200,
      top: 0,
      bottom: 40,
      x: 100,
      y: 0,
      height: 40,
      toJSON: () => {},
    });

    // 5. Move past activation distance (>= 5px) over thPhone (before midpoint: clientX = 120 < 150)
    document.elementFromPoint = () => thPhone;
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 120, clientY: 10 }));
    });

    expect(hookResult.isDragging).toBe(true);
    expect(hookResult.draggedId).toBe("gender");
    expect(hookResult.targetId).toBe("phone");
    expect(hookResult.dropPosition).toBe("before");
    expect(document.body.style.userSelect).toBe("none");
    expect(document.body.style.cursor).toBe("grabbing");

    // Check drop indicator on phone (should show start-0)
    expect(thPhone.innerHTML).toContain("start-0");

    // 6. Move past midpoint (clientX = 180 >= 150) -> position "after"
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 180, clientY: 10 }));
    });
    expect(hookResult.dropPosition).toBe("after");
    expect(thPhone.innerHTML).toContain("end-0");

    // 7. Move over sticky column name -> should clear targetId
    const thName = container.querySelector("#th-name") as HTMLElement;
    document.elementFromPoint = () => thName;
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 50, clientY: 10 }));
    });
    expect(hookResult.targetId).toBeNull();
    expect(hookResult.dropPosition).toBeNull();

    // 8. Move back over thPhone (after) and pointerup
    document.elementFromPoint = () => thPhone;
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 180, clientY: 10 }));
    });
    expect(hookResult.targetId).toBe("phone");

    // 9. Pointer up -> triggers onReorder
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });

    expect(onReorder).toHaveBeenCalledWith("gender", "phone", "after");
    expect(hookResult.isDragging).toBe(false);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
    expect(hookResult.suppressClickRef.current).toBe(true);

    // Timeout resets suppressClickRef
    await new Promise((resolve) => setTimeout(resolve, 130));
    expect(hookResult.suppressClickRef.current).toBe(false);

    // Test unmount cleanup while listeners active
    act(() => {
      thGender.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
          button: 0,
        }),
      );
    });
    document.elementFromPoint = originalElementFromPoint;

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
