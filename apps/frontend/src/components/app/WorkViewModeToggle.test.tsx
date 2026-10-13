import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkViewModeToggle } from "./WorkViewModeToggle";
import type { AppTranslationKey } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: AppTranslationKey) => {
      const map: Partial<Record<AppTranslationKey, string>> = {
        "common.viewMode.group": "View mode",
        "common.viewMode.table": "Table view",
        "common.viewMode.cards": "Cards view",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("WorkViewModeToggle Component", () => {
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

  it('renders table mode active with aria-pressed="true" on table button', () => {
    const html = renderToStaticMarkup(
      <WorkViewModeToggle viewMode="table" onViewModeChange={vi.fn()} />,
    );

    expect(html).toContain('aria-label="View mode"');
    expect(html).toContain('aria-label="Table view"');
    expect(html).toContain('aria-label="Cards view"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('renders cards mode active with aria-pressed="true" on cards button', () => {
    const html = renderToStaticMarkup(
      <WorkViewModeToggle viewMode="cards" onViewModeChange={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Table view"');
    expect(html).toContain('aria-label="Cards view"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("dispatches onViewModeChange with table and cards on button clicks", async () => {
    const onViewModeChange = vi.fn();

    await act(async () => {
      root.render(<WorkViewModeToggle viewMode="table" onViewModeChange={onViewModeChange} />);
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);

    const tableButton = buttons[0];
    const cardsButton = buttons[1];

    await act(async () => {
      cardsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onViewModeChange).toHaveBeenCalledWith("cards");

    await act(async () => {
      tableButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onViewModeChange).toHaveBeenCalledWith("table");
  });

  it("renders disabled state and custom className when provided", () => {
    const html = renderToStaticMarkup(
      <WorkViewModeToggle
        viewMode="table"
        onViewModeChange={vi.fn()}
        disabled={true}
        className="custom-toggle-class"
      />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain("custom-toggle-class");
  });
});
