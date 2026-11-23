import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WidgetCard } from "./WidgetCard";
import { WidgetCardHeader } from "./WidgetCardHeader";

function parseFirst(html: string): HTMLElement {
  const node = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
  if (!(node instanceof HTMLElement)) throw new Error("expected an element");
  return node;
}

describe("WidgetCard", () => {
  it("given a header, should inset the start edge once (header only) rather than stacking the card inset", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <WidgetCard accentColor="primary">
        <WidgetCardHeader title="Today's Attendance Summary" />
        <section className="p-5">Body</section>
      </WidgetCard>,
    );

    // Act
    const card = parseFirst(html);
    const header = card.querySelector("header");

    // Assert
    expect(card.classList.contains("ps-0")).toBe(true);
    expect(card.classList.contains("sm:ps-6")).toBe(false);
    expect(header?.classList.contains("sm:ps-6")).toBe(true);
  });

  it("given consumer padding, should let it win at every breakpoint", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <WidgetCard accentColor="primary" className="p-5">
        Chart
      </WidgetCard>,
    );

    // Act
    const card = parseFirst(html);

    // Assert
    expect(card.classList.contains("p-5")).toBe(true);
    expect(card.classList.contains("ps-0")).toBe(false);
    expect(card.classList.contains("sm:ps-6")).toBe(false);
  });

  it("given narrative text, should render it after the widget body", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <WidgetCard narrativeText="Attendance is steady.">Body</WidgetCard>,
    );

    // Act
    const card = parseFirst(html);

    // Assert
    expect(card.lastElementChild?.textContent).toBe("Attendance is steady.");
  });
});
