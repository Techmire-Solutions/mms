import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppPageShellSkeleton } from "@mms/ui";
import { AppPageShell } from "./AppPageShell";

describe("AppPageShell", () => {
  it("renders SEO metadata, header slot, metrics, and children", () => {
    const html = renderToStaticMarkup(
      <AppPageShell
        seoTitle="Platform Settings | MMS"
        seoDescription="Platform administrative control"
        headerSlot={<header id="custom-header">Header</header>}
        metricsSlot={<div id="metrics-strip">Metrics</div>}
      >
        <main id="main-content">Platform Content</main>
      </AppPageShell>,
    );

    expect(html).toContain("<title>Platform Settings | MMS</title>");
    expect(html).toContain('name="description" content="Platform administrative control"');
    expect(html).toContain("custom-header");
    expect(html).toContain("metrics-strip");
    expect(html).toContain("main-content");
  });

  it("handles isBusy and drawerOutlet correctly", () => {
    const html = renderToStaticMarkup(
      <AppPageShell isBusy={true} drawerOutlet={<aside id="drawer">Slide Over</aside>}>
        <div>Content</div>
      </AppPageShell>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('id="drawer"');
  });

  it("renders AppPageShellSkeleton with slot filtering", () => {
    const html = renderToStaticMarkup(<AppPageShellSkeleton slots={["header", "table"]} />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("animate-pulse");
  });

  it("given a header and metrics, should group them so the KPI strip sits close under the header", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <AppPageShell
        headerSlot={<header id="custom-header">Header</header>}
        metricsSlot={<div id="metrics-strip">Metrics</div>}
      >
        <div id="tiers">Tiers</div>
      </AppPageShell>,
    );

    // Act
    const doc = new DOMParser().parseFromString(html, "text/html");
    const group = doc.getElementById("custom-header")?.parentElement;

    // Assert
    expect(group?.className).toBe("space-y-4 sm:space-y-5");
    expect(doc.getElementById("metrics-strip")?.parentElement).toBe(group);
    expect(doc.getElementById("tiers")?.parentElement).not.toBe(group);
  });
});
