import { describe, expect, it } from "vitest";
import {
  BRANDING_IDENTITY_FIELD_KEYS,
  BRANDING_THEME_FIELD_KEYS,
  DEFAULT_BRANDING_SETTINGS,
  mergeBrandingSettings,
} from "@mms/contracts";
import {
  mergeBrandingIdentityForSave,
  mergeBrandingThemeForSave,
  retainIdentityDraftAfterThemeSave,
  retainThemeDraftAfterIdentitySave,
} from "@/lib/brandingIdentityDraft";

describe("brandingIdentityDraft", () => {
  it("mergeBrandingIdentityForSave keeps theme fields from baseline", () => {
    const baseline = mergeBrandingSettings({
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Saved",
      primaryColor: "#111111",
      footerText: "Saved footer",
    });
    const draft = mergeBrandingSettings({
      ...baseline,
      madrasaName: "Draft name",
      primaryColor: "#222222",
      footerText: "Draft footer",
    });
    const persisted = mergeBrandingIdentityForSave(draft, baseline);
    expect(persisted.madrasaName).toBe("Draft name");
    expect(persisted.primaryColor).toBe("#111111");
    expect(persisted.footerText).toBe("Saved footer");
  });

  it("retainThemeDraftAfterIdentitySave keeps unsaved theme edits", () => {
    const persisted = mergeBrandingSettings({
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Saved",
      primaryColor: "#111111",
    });
    const draft = mergeBrandingSettings({
      ...persisted,
      primaryColor: "#abcdef",
      footerText: "Draft footer",
    });
    const next = retainThemeDraftAfterIdentitySave(persisted, draft);
    expect(next.madrasaName).toBe("Saved");
    expect(next.primaryColor).toBe("#abcdef");
    expect(next.footerText).toBe("Draft footer");
  });

  it("uses identity keys only for save merge", () => {
    const baseline = mergeBrandingSettings(DEFAULT_BRANDING_SETTINGS);
    const draft = mergeBrandingSettings({
      ...baseline,
      tagline: "New tagline",
      cornerStyle: "sharp",
    });
    const persisted = mergeBrandingIdentityForSave(draft, baseline);
    expect(persisted.tagline).toBe("New tagline");
    expect(persisted.cornerStyle).toBe(baseline.cornerStyle);
    expect(BRANDING_IDENTITY_FIELD_KEYS).toContain("tagline");
    expect(BRANDING_THEME_FIELD_KEYS).toContain("cornerStyle");
  });

  it("mergeBrandingThemeForSave keeps identity fields from baseline", () => {
    const baseline = mergeBrandingSettings({
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Saved",
      primaryColor: "#111111",
    });
    const draft = mergeBrandingSettings({
      ...baseline,
      madrasaName: "Draft name",
      primaryColor: "#222222",
    });
    const persisted = mergeBrandingThemeForSave(draft, baseline);
    expect(persisted.primaryColor).toBe("#222222");
    expect(persisted.madrasaName).toBe("Saved");
    expect(BRANDING_THEME_FIELD_KEYS).toContain("primaryColor");
    expect(BRANDING_IDENTITY_FIELD_KEYS).toContain("madrasaName");
  });

  it("retainIdentityDraftAfterThemeSave keeps unsaved identity edits", () => {
    const persisted = mergeBrandingSettings({
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Saved",
      primaryColor: "#abcdef",
    });
    const currentDraft = mergeBrandingSettings({
      ...persisted,
      madrasaName: "Staged name",
      tagline: "Staged tagline",
    });
    const next = retainIdentityDraftAfterThemeSave(persisted, currentDraft);
    expect(next.primaryColor).toBe("#abcdef");
    expect(next.madrasaName).toBe("Staged name");
    expect(next.tagline).toBe("Staged tagline");
  });
});
