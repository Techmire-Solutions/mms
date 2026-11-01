import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactEmailAction } from "./ContactEmailAction";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ContactEmailAction", () => {
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
    vi.restoreAllMocks();
  });

  it("opts the email value out of the in-cell wrap override so it ellipsizes", async () => {
    // Regression guard for the 2026-10-31 review (UX-07): inside a table cell
    // the global `table td .truncate` rule forced wrapping, so `mansoor@example.com`
    // broke mid-token. `data-cell-truncate` is the documented opt-out.
    await act(async () => {
      root.render(<ContactEmailAction email="mansoor@example.com" name="Mansoor" />);
    });

    const value = container.querySelector<HTMLElement>("[data-cell-truncate]");
    expect(value).not.toBeNull();
    expect(value?.getAttribute("title")).toBe("mansoor@example.com");
    expect(value?.className).toContain("truncate");
    expect(value?.className).toContain("block");
  });
});
