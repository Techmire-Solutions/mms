import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EditableSelect } from "./EditableSelect";
import { useDropdownListbox } from "./useDropdownListbox";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params && "option" in params) return `Remove ${params.option}`;
      return key;
    },
  }),
}));

describe("EditableSelect", () => {
  it("renders trigger with ARIA listbox attributes", () => {
    const markup = renderToStaticMarkup(
      <EditableSelect
        options={["Father", "Mother"]}
        value="Father"
        onChange={() => {}}
        id="rel-select"
      />,
    );

    expect(markup).toContain('id="rel-select"');
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-controls="rel-select-listbox"');
    expect(markup).toContain("contacts.options.relationship.father");
  });
});

describe("useDropdownListbox hook keyboard traversal", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it("cycles through options with ArrowDown and ArrowUp", () => {
    const options = ["Option A", "Option B", "Option C"];
    const onSelect = vi.fn();
    const stateRef: { current: ReturnType<typeof useDropdownListbox> | null } = {
      current: null,
    };

    function TestComponent() {
      stateRef.current = useDropdownListbox({
        options,
        value: "Option A",
        onSelect,
      });
      return null;
    }

    act(() => {
      root?.render(<TestComponent />);
    });

    expect(stateRef.current).not.toBeNull();

    act(() => {
      stateRef.current?.setOpen(true);
    });

    expect(stateRef.current?.open).toBe(true);
    expect(stateRef.current?.highlightedIndex).toBe(0);

    // Arrow down moves to next
    act(() => {
      stateRef.current?.moveHighlight(1);
    });
    expect(stateRef.current?.highlightedIndex).toBe(1);

    // Arrow down moves to next
    act(() => {
      stateRef.current?.moveHighlight(1);
    });
    expect(stateRef.current?.highlightedIndex).toBe(2);

    // Arrow down wraps to start
    act(() => {
      stateRef.current?.moveHighlight(1);
    });
    expect(stateRef.current?.highlightedIndex).toBe(0);

    // Arrow up wraps to end
    act(() => {
      stateRef.current?.moveHighlight(-1);
    });
    expect(stateRef.current?.highlightedIndex).toBe(2);
  });

  it("dispatches selection on Enter key", () => {
    const options = ["Apple", "Banana", "Cherry"];
    const onSelect = vi.fn();
    const stateRef: { current: ReturnType<typeof useDropdownListbox> | null } = {
      current: null,
    };

    function TestComponent() {
      stateRef.current = useDropdownListbox({
        options,
        onSelect,
      });
      return null;
    }

    act(() => {
      root?.render(<TestComponent />);
    });

    act(() => {
      stateRef.current?.setOpen(true);
      stateRef.current?.setHighlightedIndex(1);
    });

    const enterEvent = {
      key: "Enter",
      preventDefault: vi.fn(),
      target: { tagName: "DIV" },
    } as unknown as React.KeyboardEvent<HTMLElement>;

    act(() => {
      stateRef.current?.handleKeyDown(enterEvent);
    });

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("Banana");
  });
});

describe("EditableSelect search", () => {
  const OPTIONS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const renderAndOpen = (options: string[]) => {
    const onChange = vi.fn();
    act(() => {
      root.render(<EditableSelect id="pick" options={options} value="" onChange={onChange} />);
    });
    const trigger = container.querySelector<HTMLButtonElement>("#pick")!;
    act(() => {
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      trigger.click();
    });
    return onChange;
  };

  const typeInto = (input: HTMLInputElement, text: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setter?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("given a long list, should filter options and pick the first match when Enter is pressed", () => {
    // Arrange
    const onChange = renderAndOpen(OPTIONS);
    const search = document.querySelector<HTMLInputElement>("input[data-listbox-search]");

    // Act
    typeInto(search!, "fox");
    act(() => {
      search!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    // Assert
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(onChange).toHaveBeenCalledWith("Foxtrot");
  });

  it("given no match, should announce the empty state when searching", () => {
    // Arrange
    renderAndOpen(OPTIONS);
    const search = document.querySelector<HTMLInputElement>("input[data-listbox-search]")!;

    // Act
    typeInto(search, "zulu");

    // Assert
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(document.querySelector('[role="status"]')?.textContent).toBe("common.noMatchingOptions");
  });

  it("given a short list, should not render a search box when opened", () => {
    // Arrange / Act
    renderAndOpen(OPTIONS.slice(0, 3));

    // Assert
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(document.querySelector("input[data-listbox-search]")).toBeNull();
  });
});
