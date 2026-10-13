import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleTrashToggle } from "./ModuleTrashToggle";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ModuleTrashToggle Component", () => {
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
    document.body.removeChild(container);
  });

  it('renders idle state with showDeletedLabel and aria-pressed="false"', () => {
    const html = renderToStaticMarkup(
      <ModuleTrashToggle
        showDeleted={false}
        onToggle={vi.fn()}
        showActiveLabel="View Active"
        showDeletedLabel="Trash"
      />,
    );

    expect(html).toContain("Trash");
    expect(html).not.toContain("View Active");
    expect(html).toContain('aria-pressed="false"');
  });

  it('renders active state with showActiveLabel and aria-pressed="true"', () => {
    const html = renderToStaticMarkup(
      <ModuleTrashToggle
        showDeleted={true}
        onToggle={vi.fn()}
        showActiveLabel="View Active"
        showDeletedLabel="Trash"
      />,
    );

    expect(html).toContain("View Active");
    expect(html).not.toContain("Trash");
    expect(html).toContain('aria-pressed="true"');
  });

  it("dispatches onToggle when clicked", async () => {
    const onToggle = vi.fn();

    await act(async () => {
      root.render(
        <ModuleTrashToggle
          showDeleted={false}
          onToggle={onToggle}
          showActiveLabel="View Active"
          showDeletedLabel="Trash"
        />,
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders disabled state and title attribute when provided", () => {
    const html = renderToStaticMarkup(
      <ModuleTrashToggle
        showDeleted={false}
        onToggle={vi.fn()}
        showActiveLabel="View Active"
        showDeletedLabel="Trash"
        disabled={true}
        title="Archived records"
      />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('title="Archived records"');
  });
});
