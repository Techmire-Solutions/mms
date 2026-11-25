import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsPanel } from "@mms/fe-core/components/SettingsShell";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, dir: "ltr" }),
}));

describe("SettingsPanel", () => {
  it("pins sticky actions above the fields so save is immediately reachable", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        width="narrow"
        introKey="settings.introGlobal"
        footerSticky
        footer={<button type="button">Save</button>}
      >
        <div data-testid="settings-content">Fields</div>
      </SettingsPanel>,
    );

    const stickyIndex = html.indexOf("sticky top-header");
    const contentIndex = html.indexOf("settings-content");
    expect(stickyIndex).toBeGreaterThan(-1);
    expect(contentIndex).toBeGreaterThan(stickyIndex);
  });

  it("keeps the footer at the bottom for short panels", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        width="narrow"
        introKey="settings.introGlobal"
        footer={<button type="button">Save</button>}
      >
        <div data-testid="settings-content">Fields</div>
      </SettingsPanel>,
    );

    expect(html.indexOf("Save")).toBeGreaterThan(html.indexOf("settings-content"));
  });

  it("given a wide settings card, should centre the capped column so both sides get equal space", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <SettingsPanel width="narrow" introKey="settings.introGlobal">
        <div>Fields</div>
      </SettingsPanel>,
    );

    // Act
    const panel = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;

    // Assert
    expect(panel?.classList.contains("max-w-2xl")).toBe(true);
    expect(panel?.classList.contains("mx-auto")).toBe(true);
    expect(panel?.classList.contains("w-full")).toBe(true);
  });
});
