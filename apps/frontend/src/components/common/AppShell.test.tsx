import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, type NavigationAdapter } from "@/components/common/AppShell";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";

function renderWithContext(ui: React.ReactElement, contextOverrides = {}) {
  const context = {
    language: "en",
    t: ((key: string) => key) as TranslationFunction,
    isLoading: false,
    dir: "ltr" as const,
    isRtl: false,
    ...contextOverrides,
  };
  return renderToStaticMarkup(
    <TranslationContext.Provider value={context}>{ui}</TranslationContext.Provider>,
  );
}

describe("AppShell — Universal Layout Shell", () => {
  it("renders SkipToContentLink pointing to #main-content", () => {
    const html = renderWithContext(
      <AppShell>
        <div>Page Body</div>
      </AppShell>,
    );

    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain("Page Body");
  });

  it("renders desktop sidebar with accessible navigation landmark when sidebar is provided", () => {
    const html = renderWithContext(
      <AppShell sidebar={<nav id="test-sidebar">Sidebar Content</nav>}>
        <div>Main Content</div>
      </AppShell>,
    );

    expect(html).toContain("<aside");
    expect(html).toContain('aria-label="nav.desktopNavigation"');
    expect(html).toContain('id="test-sidebar"');
    expect(html).toContain("Sidebar Content");
  });

  it("does not render desktop sidebar aside landmark when sidebar is not provided", () => {
    const html = renderWithContext(
      <AppShell>
        <div>Content Without Sidebar</div>
      </AppShell>,
    );

    expect(html).not.toContain("<aside");
  });

  it("renders desktop and mobile top headers with banner landmark roles", () => {
    const html = renderWithContext(
      <AppShell
        topBar={<div id="desktop-bar">Desktop TopBar</div>}
        mobileHeader={<div id="mobile-bar">Mobile Header</div>}
      >
        <div>Main Body</div>
      </AppShell>,
    );

    expect(html).toContain('id="desktop-bar"');
    expect(html).toContain('id="mobile-bar"');
    expect(html).toContain('role="banner"');
    expect(html).toContain("pt-14 lg:pt-16");
  });

  it("applies lg:ps-sidebar class when sidebar is active and sidebarCollapsed=false", () => {
    const html = renderWithContext(
      <AppShell sidebar={<div>Sidebar</div>} sidebarCollapsed={false}>
        <div>Content</div>
      </AppShell>,
    );

    expect(html).toContain("lg:ps-sidebar");
    expect(html).not.toContain("lg:ps-sidebar-collapsed");
  });

  it("applies lg:ps-sidebar-collapsed class when sidebar is active and sidebarCollapsed=true", () => {
    const html = renderWithContext(
      <AppShell sidebar={<div>Sidebar</div>} sidebarCollapsed={true}>
        <div>Content</div>
      </AppShell>,
    );

    expect(html).toContain("lg:ps-sidebar-collapsed");
    expect(html).not.toContain("lg:ps-sidebar ");
  });

  it("forwards BiDi dir and BCP-47 lang attributes to outermost container", () => {
    const html = renderWithContext(
      <AppShell dir="rtl" lang="ar">
        <div>Arabic Content</div>
      </AppShell>,
    );

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
  });

  it("renders all NavigationAdapter slots properly", () => {
    const adapter: NavigationAdapter = {
      sidebar: <div id="adapter-sidebar">Adapter Sidebar</div>,
      mobileSidebar: <div id="adapter-mobile-sidebar">Adapter Mobile Sidebar</div>,
      topBar: <div id="adapter-topbar">Adapter TopBar</div>,
      mobileHeader: <div id="adapter-mobile-header">Adapter Mobile Header</div>,
      commandPalette: <div id="adapter-palette">Command Palette</div>,
      extraModals: <div id="adapter-modals">Extra Modals</div>,
      notifications: <div id="adapter-notifications">Notification Center</div>,
      footer: <footer id="adapter-footer">Footer Content</footer>,
    };

    const html = renderWithContext(
      <AppShell adapter={adapter}>
        <div>Main Content</div>
      </AppShell>,
    );

    expect(html).toContain("adapter-sidebar");
    expect(html).toContain("adapter-mobile-sidebar");
    expect(html).toContain("adapter-topbar");
    expect(html).toContain("adapter-mobile-header");
    expect(html).toContain("adapter-palette");
    expect(html).toContain("adapter-modals");
    expect(html).toContain("adapter-notifications");
    expect(html).toContain("adapter-footer");
  });

  it("applies contentPadding and maxWidthClass properly to main container", () => {
    const html = renderWithContext(
      <AppShell contentPadding={true} maxWidthClass="max-w-7xl">
        <div>Padded Content</div>
      </AppShell>,
    );

    expect(html).toContain("p-4 md:p-6 lg:p-8");
    expect(html).toContain("max-w-7xl");
  });

  it("omits padding classes when contentPadding=false", () => {
    const html = renderWithContext(
      <AppShell contentPadding={false}>
        <div>Unpadded Content</div>
      </AppShell>,
    );

    expect(html).not.toContain("p-4 md:p-6 lg:p-8");
  });
});
