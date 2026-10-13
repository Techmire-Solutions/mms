import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { User, Phone, Award } from "lucide-react";
import { FormModalTabs } from "./FormModalTabs";

describe("FormModalTabs", () => {
  const tabs = [
    { key: "basic", label: "Basic Info", icon: User },
    { key: "phones", label: "Phone Numbers", icon: Phone, badge: 2 },
    { key: "skills", label: "Skills", icon: Award, badge: 1, tone: "destructive" as const },
  ];

  it("renders tab bar with desktop sidebar responsive classes", () => {
    const html = renderToStaticMarkup(
      <FormModalTabs tabs={tabs} activeTab="basic" onTabChange={vi.fn()}>
        <div>Tab content</div>
      </FormModalTabs>,
    );

    // Root container supports vertical sidebar layout on desktop
    expect(html).toContain("md:flex-row");

    // Tab list renders as a sidebar with border-e and w-56 on desktop
    expect(html).toContain("md:w-56");
    expect(html).toContain("md:flex-col");
    expect(html).toContain("md:border-e");

    // All tabs and badges rendered
    expect(html).toContain("Basic Info");
    expect(html).toContain("Phone Numbers");
    expect(html).toContain("Skills");
    expect(html).toContain("Tab content");
  });

  it("renders error badge with destructive styling", () => {
    const html = renderToStaticMarkup(
      <FormModalTabs tabs={tabs} activeTab="basic" onTabChange={vi.fn()}>
        <div>Tab content</div>
      </FormModalTabs>,
    );

    expect(html).toContain("bg-destructive");
  });
});
