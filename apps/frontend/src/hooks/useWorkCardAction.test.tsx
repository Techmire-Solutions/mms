import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useWorkCardAction, type WorkCardEntity } from "./useWorkCardAction";

interface TestEntity extends WorkCardEntity {
  id: string;
  name: string;
}

const entity: TestEntity = { id: "ent-1", name: "Test Entity" };

type HookOptions = Parameters<typeof useWorkCardAction<TestEntity>>[0];

/** Minimal renderHook using React DOM (same pattern as useDirectoryTrashState.test.tsx and useWorkDirectoryController.test.tsx). */
function renderHook(options: HookOptions) {
  let result!: ReturnType<typeof useWorkCardAction<TestEntity>>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookHost() {
    result = useWorkCardAction(options);
    return null;
  }

  act(() => {
    root.render(<HookHost />);
  });

  function update(_nextOptions: HookOptions) {
    act(() => {
      root.render(<HookHost key={Math.random()} />);
    });
  }

  function unmount() {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  }

  return {
    get result() {
      return result;
    },
    update,
    unmount,
  };
}

function makeOptions(overrides: Partial<HookOptions> = {}): HookOptions {
  return {
    entity,
    selectedIds: [],
    onToggleSelected: vi.fn(),
    ...overrides,
  };
}

describe("useWorkCardAction", () => {
  it("derives isSelected=false when entity not in selectedIds", () => {
    const { result, unmount } = renderHook(makeOptions({ selectedIds: [] }));
    expect(result.isSelected).toBe(false);
    unmount();
  });

  it("derives isSelected=true when entity.id in selectedIds", () => {
    const { result, unmount } = renderHook(makeOptions({ selectedIds: ["ent-1"] }));
    expect(result.isSelected).toBe(true);
    unmount();
  });

  it("onSelect calls onToggleSelected with toggled value (false→true)", () => {
    const onToggleSelected = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ selectedIds: [], onToggleSelected }));
    act(() => {
      result.onSelect();
    });
    expect(onToggleSelected).toHaveBeenCalledWith("ent-1", true);
    unmount();
  });

  it("onSelect calls onToggleSelected with false when already selected", () => {
    const onToggleSelected = vi.fn();
    const { result, unmount } = renderHook(
      makeOptions({ selectedIds: ["ent-1"], onToggleSelected }),
    );
    act(() => {
      result.onSelect();
    });
    expect(onToggleSelected).toHaveBeenCalledWith("ent-1", false);
    unmount();
  });

  it("onSelect is a no-op when canSelect=false", () => {
    const onToggleSelected = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ canSelect: false, onToggleSelected }));
    act(() => {
      result.onSelect();
    });
    expect(onToggleSelected).not.toHaveBeenCalled();
    unmount();
  });

  it("onView calls onView prop with entity", () => {
    const onView = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onView }));
    act(() => {
      result.onView();
    });
    expect(onView).toHaveBeenCalledWith(entity);
    unmount();
  });

  it("onView is a no-op when no onView prop provided", () => {
    const { result, unmount } = renderHook(makeOptions({ onView: undefined }));
    expect(() => {
      act(() => {
        result.onView();
      });
    }).not.toThrow();
    unmount();
  });

  it("onEdit calls onEdit prop when provided", () => {
    const onEdit = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onEdit }));
    act(() => {
      result.onEdit();
    });
    expect(onEdit).toHaveBeenCalledWith(entity);
    unmount();
  });

  it("onEdit falls back to onView when no onEdit provided", () => {
    const onView = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onView, onEdit: undefined }));
    act(() => {
      result.onEdit();
    });
    expect(onView).toHaveBeenCalledWith(entity);
    unmount();
  });

  it("onKeyDown Space triggers onSelect", () => {
    const onToggleSelected = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onToggleSelected }));
    const spaceEvent = {
      key: " ",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;
    act(() => {
      result.onKeyDown(spaceEvent);
    });
    expect(spaceEvent.preventDefault).toHaveBeenCalled();
    expect(onToggleSelected).toHaveBeenCalledWith("ent-1", true);
    unmount();
  });

  it("onKeyDown Enter triggers onView", () => {
    const onView = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onView }));
    const enterEvent = {
      key: "Enter",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;
    act(() => {
      result.onKeyDown(enterEvent);
    });
    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(onView).toHaveBeenCalledWith(entity);
    unmount();
  });

  it("onKeyDown does not react to unrelated keys", () => {
    const onToggleSelected = vi.fn();
    const onView = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onToggleSelected, onView }));
    const event = {
      key: "Tab",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;
    act(() => {
      result.onKeyDown(event);
    });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onToggleSelected).not.toHaveBeenCalled();
    expect(onView).not.toHaveBeenCalled();
    unmount();
  });

  it("supports Set<string> for selectedIds", () => {
    const { result, unmount } = renderHook(makeOptions({ selectedIds: new Set(["ent-1"]) }));
    expect(result.isSelected).toBe(true);
    unmount();
  });

  it("supports numeric id matching", () => {
    interface NumEntity extends WorkCardEntity {
      id: number;
      name: string;
    }
    let numResult!: ReturnType<typeof useWorkCardAction<NumEntity>>;
    const numEntity: NumEntity = { id: 42, name: "Numeric Entity" };

    function HookHost() {
      numResult = useWorkCardAction({
        entity: numEntity,
        selectedIds: ["42"],
      });
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<HookHost />);
    });
    expect(numResult.isSelected).toBe(true);
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("onSelectOnly calls onSelectOnly callback when provided", () => {
    const onSelectOnly = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onSelectOnly }));
    act(() => {
      result.onSelectOnly();
    });
    expect(onSelectOnly).toHaveBeenCalledWith("ent-1");
    unmount();
  });

  it("executeQuickAction executes onQuickAction with key and entity", () => {
    const onQuickAction = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onQuickAction }));
    act(() => {
      result.executeQuickAction("approve", { reason: "verified" });
    });
    expect(onQuickAction).toHaveBeenCalledWith("approve", entity, { reason: "verified" });
    unmount();
  });

  it("derives statusBadge when getStatusKey and statusConfig are provided", () => {
    const statusConfig = {
      active: { label: "Active", cls: "bg-success" },
    };
    const { result, unmount } = renderHook(
      makeOptions({
        statusConfig,
        getStatusKey: () => "active",
      }),
    );
    expect(result.statusBadge).toEqual({
      status: "active",
      config: { label: "Active", cls: "bg-success" },
    });
    unmount();
  });

  it("onKeyDown does not react when event originates from a child element (target !== currentTarget)", () => {
    const onToggleSelected = vi.fn();
    const onView = vi.fn();
    const { result, unmount } = renderHook(makeOptions({ onToggleSelected, onView }));
    const childTarget = document.createElement("button");
    const containerTarget = document.createElement("div");
    const spaceEvent = {
      key: " ",
      target: childTarget,
      currentTarget: containerTarget,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;
    act(() => {
      result.onKeyDown(spaceEvent);
    });
    expect(spaceEvent.preventDefault).not.toHaveBeenCalled();
    expect(onToggleSelected).not.toHaveBeenCalled();

    const enterEvent = {
      key: "Enter",
      target: childTarget,
      currentTarget: containerTarget,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;
    act(() => {
      result.onKeyDown(enterEvent);
    });
    expect(enterEvent.preventDefault).not.toHaveBeenCalled();
    expect(onView).not.toHaveBeenCalled();
    unmount();
  });

  it("cardProps provides stable container props for EntityCard", () => {
    const { result, unmount } = renderHook(makeOptions({ selectedIds: ["ent-1"] }));
    expect(result.cardProps.tabIndex).toBe(0);
    expect(result.cardProps.role).toBe("article");
    expect(result.cardProps["data-selected"]).toBe(true);
    expect(result.cardProps.onKeyDown).toBe(result.onKeyDown);
    unmount();
  });

  it("cardProps leaves tabIndex undefined when neither selection nor view/edit is possible", () => {
    const { result, unmount } = renderHook(
      makeOptions({
        canSelect: false,
        onView: undefined,
        onEdit: undefined,
      }),
    );
    expect(result.cardProps.tabIndex).toBeUndefined();
    unmount();
  });

  it("cardProps provides tabIndex 0 when onView is provided even if canSelect is false", () => {
    const { result, unmount } = renderHook(
      makeOptions({
        canSelect: false,
        onView: vi.fn(),
      }),
    );
    expect(result.cardProps.tabIndex).toBe(0);
    unmount();
  });
});
