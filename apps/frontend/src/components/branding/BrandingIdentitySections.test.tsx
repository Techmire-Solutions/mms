import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandingSettingsProfileSection } from "./BrandingIdentitySections";
import { DEFAULT_BRANDING_SETTINGS, type BrandingSettings } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/branding/BrandingShared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/branding/BrandingShared")>();
  return {
    ...actual,
    ImageUploadField: () => <div data-testid="image-upload" />,
  };
});

const data: BrandingSettings = {
  ...DEFAULT_BRANDING_SETTINGS,
  madrasaName: "Al-Hadi Academy",
  tagline: "Excellence in Islamic Education",
};

function render(upd = vi.fn()): string {
  return renderToStaticMarkup(<BrandingSettingsProfileSection data={data} upd={upd} />);
}

describe("BrandingSettingsProfileSection", () => {
  it("renders the platform-owned madrasa name as read-only with the managed hint", () => {
    const html = render();
    expect(html).toContain('id="madrasaName"');
    expect(html).toContain("readOnly");
    expect(html).toContain("disabled");
    expect(html).toContain("branding.madrasaNameManaged");
  });

  it("keeps the tagline editable", () => {
    const html = render();
    expect(html).toContain('id="tagline"');
    expect(html).toContain("branding.taglineHint");
    // Only the name is locked: the tagline input must stay interactive.
    const taglineSegment = html.slice(html.indexOf('id="tagline"'));
    expect(taglineSegment.slice(0, 400)).not.toContain("readonly");
  });
});
