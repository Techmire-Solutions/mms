import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPaletteModal } from "./CommandPaletteModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface PaletteProps {
  open: boolean;
  onClose: () => void;
}

function Palette({ open, onClose }: PaletteProps): React.JSX.Element {
  return (
    <CommandPaletteModal
      open={open}
      onClose={onClose}
      ariaLabel="Command palette"
      searchPlaceholder="Search"
      query=""
      onQueryChange={() => {}}
      onKeyDown={() => {}}
      listboxId="palette-listbox"
    >
      <ul>
        <li>
          <button type="button">First result</button>
        </li>
      </ul>
    </CommandPaletteModal>
  );
}

describe("CommandPaletteModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // happy-dom reports zero-size rects, which the focus trap filters out.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("given an open palette, should trap Tab inside the dialog when tabbing past the last result", async () => {
    // Arrange
    await act(async () => {
      root.render(<Palette open onClose={() => {}} />);
    });
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>("input");
    const resultButton = dialog?.querySelector<HTMLButtonElement>("button");
    expect(dialog).not.toBeNull();
    expect(input).not.toBeNull();
    expect(resultButton).not.toBeNull();
    expect(dialog?.contains(document.activeElement)).toBe(true);

    // Act
    resultButton?.focus();
    await act(async () => {
      resultButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });

    // Assert
    expect(document.activeElement).toBe(input);
  });

  it("given focus on a result row, should close on Escape when the overlay owns the key", async () => {
    // Arrange
    const onClose = vi.fn();
    await act(async () => {
      root.render(<Palette open onClose={onClose} />);
    });
    const resultButton = container.querySelector<HTMLButtonElement>('[role="dialog"] button');
    resultButton?.focus();

    // Act
    await act(async () => {
      resultButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("given the palette unmounts, should return focus to the element that opened it", async () => {
    // Arrange
    const trigger = document.createElement("button");
    trigger.textContent = "Open palette";
    document.body.appendChild(trigger);
    trigger.focus();

    await act(async () => {
      root.render(<Palette open onClose={() => {}} />);
    });

    // Act
    await act(async () => {
      root.unmount();
    });

    // Assert
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
