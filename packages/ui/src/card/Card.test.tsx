import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./Card";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Card component", () => {
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

  it("renders card content with overflow-clip and surface classes", async () => {
    await act(async () => {
      root.render(
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>System metrics summary</CardDescription>
          </CardHeader>
          <CardContent>Content Area</CardContent>
          <CardFooter>Footer Area</CardFooter>
        </Card>,
      );
    });

    const card = container.firstElementChild as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.className).toContain("overflow-clip");
    expect(card.className).toContain("rounded-2xl");
    expect(container.textContent).toContain("Overview");
    expect(container.textContent).toContain("System metrics summary");
    expect(container.textContent).toContain("Content Area");
    expect(container.textContent).toContain("Footer Area");
  });

  it("renders decorative accent stripe when accentColor is specified", async () => {
    await act(async () => {
      root.render(<Card accentColor="success">Success Card</Card>);
    });
    const stripe = container.querySelector('[aria-hidden="true"]');
    expect(stripe).toBeTruthy();
    expect(stripe?.className).toContain("bg-success/45");
  });

  it("omits accent stripe when accentColor is none or false", async () => {
    await act(async () => {
      root.render(<Card accentColor="none">Plain Card</Card>);
    });
    const stripe = container.querySelector('[aria-hidden="true"]');
    expect(stripe).toBeNull();
  });

  it("applies interactive focus and tap styles when interactive is true", async () => {
    await act(async () => {
      root.render(<Card interactive>Interactive Card</Card>);
    });
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("cursor-pointer");
    expect(card.className).toContain("focus-visible:ring-2");
  });

  it("activates an interactive card on Enter and Space", async () => {
    const onClick = vi.fn();
    await act(async () => {
      root.render(
        <Card interactive onClick={onClick}>
          <CardContent>Interactive</CardContent>
        </Card>,
      );
    });

    const card = container.querySelector<HTMLDivElement>("[role='button']");
    expect(card).toBeTruthy();
    expect(card!.tabIndex).toBe(0);

    await act(async () => {
      card!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onClick).toHaveBeenCalledTimes(1);

    await act(async () => {
      card!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("given a consumer start padding, should apply it at every breakpoint instead of keeping sm:ps-6", async () => {
    // Arrange
    const render = () => root.render(<Card className="p-0 overflow-hidden">Flush rows</Card>);

    // Act
    await act(async () => {
      render();
    });
    const card = container.firstElementChild as HTMLElement;

    // Assert
    expect(card.classList.contains("p-0")).toBe(true);
    expect(card.classList.contains("sm:ps-6")).toBe(false);
    expect(card.classList.contains("ps-5")).toBe(false);
  });

  it("given no consumer padding, should reserve the responsive stripe inset", async () => {
    // Arrange
    const render = () => root.render(<Card className="space-y-3">Default</Card>);

    // Act
    await act(async () => {
      render();
    });
    const card = container.firstElementChild as HTMLElement;

    // Assert
    expect(card.classList.contains("ps-5")).toBe(true);
    expect(card.classList.contains("sm:ps-6")).toBe(true);
  });

  it("given a padding that does not touch the start edge, should keep the stripe inset", async () => {
    // Arrange
    const render = () => root.render(<Card className="pt-5">Top padded</Card>);

    // Act
    await act(async () => {
      render();
    });
    const card = container.firstElementChild as HTMLElement;

    // Assert
    expect(card.classList.contains("pt-5")).toBe(true);
    expect(card.classList.contains("sm:ps-6")).toBe(true);
  });

  it("given no accent stripe, should not add any stripe inset", async () => {
    // Arrange
    const render = () => root.render(<Card accentColor="none">Plain</Card>);

    // Act
    await act(async () => {
      render();
    });
    const card = container.firstElementChild as HTMLElement;

    // Assert
    expect(card.classList.contains("ps-5")).toBe(false);
    expect(card.classList.contains("sm:ps-6")).toBe(false);
  });
});
