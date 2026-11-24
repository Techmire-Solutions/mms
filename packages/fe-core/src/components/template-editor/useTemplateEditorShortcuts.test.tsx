import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useTemplateEditorShortcuts } from "./useTemplateEditorShortcuts";
import { useTemplateEditorPan } from "./useTemplateEditorPan";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EDITOR_ID = "editor-a";

let container: HTMLDivElement;
let root: Root;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
}

async function render(node: React.ReactElement): Promise<void> {
  await act(async () => {
    root.render(node);
  });
}

function keydown(target: EventTarget, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
}

describe("template editor shortcut scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("ignores keys that originate outside the editor instance", async () => {
    const deleteSelected = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Harness() {
      useTemplateEditorShortcuts({
        undo: vi.fn(),
        redo: vi.fn(),
        selectAll: vi.fn(),
        deselectAll: vi.fn(),
        duplicateSelected: vi.fn(),
        deleteSelected,
        nudgeSelected: vi.fn(),
        hasSelection: true,
        editorId: EDITOR_ID,
      });
      return (
        <div data-template-editor-root={EDITOR_ID}>
          <button type="button" id="inside">
            inside
          </button>
        </div>
      );
    }

    await render(
      <>
        <Harness />
        <button type="button" id="outside">
          outside
        </button>
      </>,
    );

    await act(async () => {
      keydown(container.querySelector("#outside")!, "Delete");
    });
    expect(deleteSelected).not.toHaveBeenCalled();

    await act(async () => {
      keydown(container.querySelector("#inside")!, "Delete");
    });
    expect(deleteSelected).toHaveBeenCalledTimes(1);
  });

  it("still handles keys dispatched on the editor root itself", async () => {
    const selectAll = vi.fn();

    function Harness() {
      useTemplateEditorShortcuts({
        undo: vi.fn(),
        redo: vi.fn(),
        selectAll,
        deselectAll: vi.fn(),
        duplicateSelected: vi.fn(),
        deleteSelected: vi.fn(),
        nudgeSelected: vi.fn(),
        hasSelection: false,
        editorId: EDITOR_ID,
      });
      return <div data-template-editor-root={EDITOR_ID} id="root" />;
    }

    const tree = <Harness />;
    mount();
    await render(tree);

    await act(async () => {
      keydown(container.querySelector("#root")!, "a", { ctrlKey: true });
    });
    expect(selectAll).toHaveBeenCalledTimes(1);
  });
});

describe("template editor pan shortcut scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("does not swallow Space outside the editor", async () => {
    function Harness() {
      const { isSpacePressed } = useTemplateEditorPan(undefined, EDITOR_ID);
      return (
        <div data-template-editor-root={EDITOR_ID} data-testid="root">
          {String(isSpacePressed)}
        </div>
      );
    }

    const tree = (
      <>
        <Harness />
        <button type="button" id="page-button">
          page
        </button>
      </>
    );
    mount();
    await render(tree);

    const outside = container.querySelector<HTMLElement>("#page-button")!;
    const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
    await act(async () => {
      outside.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector('[data-testid="root"]')?.textContent).toBe("false");
  });
});
