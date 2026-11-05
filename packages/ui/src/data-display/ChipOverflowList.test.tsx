import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChipOverflowList } from "./ChipOverflowList";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TAGS = ["Active", "Coordinator", "Office Admin", "Scholar", "Staff", "VIP"];

describe("ChipOverflowList", () => {
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

  const renderList = async (items: string[], onParentClick = vi.fn()) => {
    await act(async () => {
      root.render(
        <div onClick={onParentClick}>
          <ChipOverflowList
            items={items}
            getKey={(tag) => tag}
            renderItem={(tag) => <span>{tag}</span>}
            maxVisible={3}
            moreLabel={(count) => `+${count}`}
            moreAriaLabel={(count) => `Show ${count} more tags`}
          />
        </div>,
      );
    });
    return onParentClick;
  };

  it("given more items than maxVisible, should show the first items and a +N trigger", async () => {
    // Arrange
    await renderList(TAGS);

    // Act
    const trigger = container.querySelector<HTMLButtonElement>("button");

    // Assert
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("Office Admin");
    expect(container.textContent).not.toContain("Scholar");
    expect(trigger).toBeInstanceOf(HTMLButtonElement);
    expect(trigger?.textContent).toBe("+3");
    expect(trigger?.getAttribute("aria-label")).toBe("Show 3 more tags");
  });

  it("given the +N trigger is clicked, should reveal the hidden items without bubbling to the row", async () => {
    // Arrange
    const onParentClick = await renderList(TAGS);
    const trigger = container.querySelector<HTMLButtonElement>("button");

    // Act
    await act(async () => {
      trigger?.click();
    });

    // Assert
    expect(document.body.textContent).toContain("Scholar");
    expect(document.body.textContent).toContain("VIP");
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(onParentClick).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
      "Show 3 more tags",
    );
  });

  it("given items within maxVisible, should render them all with no trigger", async () => {
    // Arrange
    await renderList(TAGS.slice(0, 3));

    // Act
    const trigger = container.querySelector("button");

    // Assert
    expect(trigger).toBeNull();
    expect(container.textContent).toBe("ActiveCoordinatorOffice Admin");
  });

  it("given no items, should render nothing", async () => {
    // Arrange
    await renderList([]);

    // Act
    const list = container.querySelector("ul");

    // Assert
    expect(list).toBeNull();
  });
});
