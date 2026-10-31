import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsPanel } from "./SettingsShell";

vi.mock("@/hooks/useTranslation", () => ({
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
});
