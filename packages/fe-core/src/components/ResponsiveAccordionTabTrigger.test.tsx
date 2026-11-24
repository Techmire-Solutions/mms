import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Globe } from "lucide-react";
import { TabTrigger } from "./ResponsiveAccordionTabTrigger";

function renderTrigger(description?: string, href?: string): HTMLElement {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <TabTrigger
        tab={{ id: "general", label: "General", description, icon: Globe, href }}
        active
        panelId="settings-panel-general"
        onTabChange={vi.fn()}
      />
    </MemoryRouter>,
  );
  const trigger = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
  if (!(trigger instanceof HTMLElement)) throw new Error("expected a trigger element");
  return trigger;
}

describe("TabTrigger", () => {
  it("given no description, should centre the title on the icon", () => {
    // Arrange
    const trigger = renderTrigger();

    // Act
    const icon = trigger.firstElementChild;

    // Assert
    expect(trigger.classList.contains("items-center")).toBe(true);
    expect(trigger.classList.contains("items-start")).toBe(false);
    expect(icon?.classList.contains("mt-0.5")).toBe(false);
  });

  it("given a description, should top-align the two-line label with the icon", () => {
    // Arrange
    const trigger = renderTrigger("Daily tasks and records");

    // Act
    const icon = trigger.firstElementChild;

    // Assert
    expect(trigger.classList.contains("items-start")).toBe(true);
    expect(icon?.classList.contains("mt-0.5")).toBe(true);
    expect(trigger.textContent).toContain("Daily tasks and records");
  });

  it("given an href, should render a link that reports its expanded state", () => {
    // Arrange
    const trigger = renderTrigger(undefined, "/settings?section=general");

    // Act
    const tagName = trigger.tagName;

    // Assert
    expect(tagName).toBe("A");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe("settings-panel-general");
  });
});
