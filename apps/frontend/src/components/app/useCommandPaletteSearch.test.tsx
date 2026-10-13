import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useCommandPaletteSearch } from "./useCommandPaletteSearch";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it("bounds selection against changing results and dispatches the rendered item after reordering", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSelect = vi.fn();
  let state: ReturnType<typeof useCommandPaletteSearch<string>>;
  function Harness({ items }: { items: string[] }) {
    state = useCommandPaletteSearch({ filterItems: () => items, onSelect, onClose: vi.fn() });
    return (
      <input
        onKeyDown={state.handleKeyDown}
        data-active={state.filteredItems[state.selectedIndex]}
      />
    );
  }
  const render = (items: string[]) => act(() => root.render(<Harness items={items} />));
  const enter = () =>
    act(() => {
      container
        .querySelector("input")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  try {
    render(["a", "b", "c"]);
    act(() => state.setSelectedIndex(2));
    render(["b"]);
    expect(container.querySelector("input")?.dataset.active).toBe("b");
    enter();
    expect(onSelect).toHaveBeenLastCalledWith("b");
    render(["c", "b", "a"]);
    expect(container.querySelector("input")?.dataset.active).toBe("a");
    enter();
    expect(onSelect).toHaveBeenLastCalledWith("a");
    render([]);
    onSelect.mockClear();
    enter();
    expect(onSelect).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
