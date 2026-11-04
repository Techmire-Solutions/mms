import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FormProgressBar } from "./FormProgressBar";

describe("FormProgressBar", () => {
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

  it("renders label and clamped progress percentage with high-contrast text", async () => {
    await act(async () => {
      root.render(<FormProgressBar value={45.6} label="Profile Completion" />);
    });

    expect(container.textContent).toContain("Profile Completion");
    expect(container.textContent).toContain("46%");

    const percentSpan = Array.from(container.querySelectorAll("span")).find((el) =>
      el.textContent?.includes("46%"),
    );
    expect(percentSpan).toBeInstanceOf(HTMLSpanElement);
    expect(percentSpan?.className).toContain("text-muted-foreground");

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeInstanceOf(HTMLDivElement);
    expect(progressbar?.getAttribute("aria-valuenow")).toBe("46");
    expect(progressbar?.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar?.getAttribute("aria-valuemax")).toBe("100");
  });

  it("applies complete styles when progress reaches 100%", async () => {
    await act(async () => {
      root.render(<FormProgressBar value={100} />);
    });

    const percentSpan = Array.from(container.querySelectorAll("span")).find((el) =>
      el.textContent?.includes("100%"),
    );
    expect(percentSpan).toBeInstanceOf(HTMLSpanElement);
    expect(percentSpan?.className).toContain("text-primary");
    expect(percentSpan?.className).not.toContain("text-muted-foreground");
  });
});
