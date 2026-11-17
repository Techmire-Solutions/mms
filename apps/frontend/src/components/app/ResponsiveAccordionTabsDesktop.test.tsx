import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResponsiveAccordionTabsDesktop } from "./ResponsiveAccordionTabsDesktop";
import type { AccordionTabItem } from "./ResponsiveAccordionTabsTypes";

const tabs: AccordionTabItem[] = [
  { id: "global", label: "General" },
  { id: "theme", label: "Theme" },
];

describe("ResponsiveAccordionTabsDesktop", () => {
  it("marks the active settings sidebar item with aria-current=page", () => {
    const html = renderToStaticMarkup(
      <ResponsiveAccordionTabsDesktop
        tabs={tabs}
        activeTab="theme"
        desktopLayout="sidebar"
        panelContent={<div>Panel</div>}
        onTabChange={vi.fn()}
        sectionAriaLabel="Settings sections"
      />,
    );

    expect(html).toContain("General");
    expect(html).toContain("Theme");
    // Exactly one active item among the two nav entries.
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("renders the horizontal layout as a tablist with aria-selected state", () => {
    const html = renderToStaticMarkup(
      <ResponsiveAccordionTabsDesktop
        tabs={tabs}
        activeTab="global"
        desktopLayout="horizontal"
        panelContent={<div>Panel</div>}
        onTabChange={vi.fn()}
        sectionAriaLabel="Module tiers"
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
  });
});
