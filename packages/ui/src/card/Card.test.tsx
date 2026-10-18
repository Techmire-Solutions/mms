import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./Card";

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
});
